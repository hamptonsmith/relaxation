# Design Journal

## Representation layers
### The problem

As a pretty firm requirement, entities are represented to the client as JSON
(after all, they must be serialized into the body of an HTTP response). However,
Mongo can represent data types unrepresentable in JSON, for example ObjectIds,
Dates, and Buffers. Indeed, Mongo's default for ids is ObjectIds and
sb-optimistic-entities' representation for createdAt_sboe and updatedAt_sboe is
as Dates.

Initially this library was written to involve three levels of representation--
the database, the "hydrated" entity in memory, and the entity as serialized into
JSON for transport. This allowed the validation function to take advantage of
methods on fancy data types. `doc.someDate.getDay() === 1` was valid, for
example. Erroneously, `patch`s also operated at this level, but of course
JSON-patch is not well-defined on non-JSON-representable values. Additionally,
`id`s must also have strategies for serialization/deserialization in URLs beyond
simple JSON. And ADDITIONALLY, at certain points `toJSON()` methods could be
inductively implied. The result was a mess of things that were creaky, wrong, or
_very_ wrong, and nearly impossible to communicate to the client.

### Potential Solutions
#### Option 1: There is only JSON

A straightforward option would be to just get rid of the idea that anything can
be anything other than JSON. We override Mongo's default ids to be strings and
we make a special case of `createdAt_sboe` and `updatedAt_sboe` to present them
as ISO 8601 strings or Unix timestamps.

This has some huge pros:

1) Very straightforward to explain and understand
2) Makes swapping out for some other database engine in the future much easier
   since nothing is married to Mongo

But there are also some downsides:

1) `createdAt_sboe` and `updatedAt_sboe` are special cases and work different
   from user-defined "dates"
2) Can't take advantage of Mongo flexibility for other sorts of types--no
   filters that take advantage of BinData's `$bitsAllSet` query because there
   are no BinDatas.
3) No easy taking advantage of special type methods by `validate`. Have to
   convert to a more sophisticated type first (e.g.
   `(new Date(d)).getDay() === 1`)

(3) isn't terrible but (1) isn't great and (2) seems like a dealbreaker.

#### Option 2: There is only JSON... until the database

This would eliminate the translation point between the in-memory entity and the
entity as serialized into JSON for transport. "toDb" and "fromDb" methods
would translate anything that should be "special" for the db's benefit, but the
_service_ would only ever think in JSON.

This seems to solve (1) and (2) from above while giving many of the benefits.

`id`s remain a little messy since they have to deal with A) potentially being in
a URL and B) are first-class entity fields unlike createdAt/updatedAt, which are
metafields.

##### Option 2a: ids remain ObjectIds by default
The default `toDb` would have to translate the `id` field to an `ObjectId`.

Some downsides:

1) if the user wishes to override `toDb` they must now do work to maintain the
   existing behavior for the `id` field. We might provide the option to pass an
   object instead that "extends" the current behavior but now all this has to be
   documented.
2) `put` operations are now quite picky about entity ids, and since the bytes of
   ObjectIds are meaningful, it's easy to create "nonsense" ids. We could
   perhaps pass along ids that don't deserialize as ObjectIds as string ids, but
   now there's a gotcha that you might "accidentally" make some ids as ObjectIds
   and others as strings.

##### Option 2b: ids are strings by default
`toDb` starts as the identity function (simple!) and the user opts-in to more
complex behavior. A few downsides:

1) This may be unexpected behavior
2) Non-sophisticated users may be exactly the ones who want ObjectIds, and those
   users may have the most difficulty implementing an ObjectId scheme
   after-the-fact
3) Whatever the tradeoffs inherent to ObjectIds, they are expected and
   well-understood, any tradeoffs made for a novel default id system would need
   to be documented carefully

#### Option 3: Just document the hell out of it

This is basically where we currently are and I don't like it much. But for
completeness we could just be very clear about the different representation
layers, make sure they have consistent names, and then document carefully where
things happen.

### My Verdict

I think Option 2 is my favorite. It removes a little bit of flexibility, but
eliminates the deal-breakers and still gives us a pretty darn straightforward
metaphor. On the id front, I think making ids be strings by default is the set
of tradeoffs I prefer (i.e., Option 2b). Folks will yell at me more (because
it's a Decision), but it's no more challenging to get rid of if you don't like
my default, and inexplicably not being able to write `PUT /foo` as an example
seems so, so odd.
