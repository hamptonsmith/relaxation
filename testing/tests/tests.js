'use strict';

const LinkHeader = require('http-link-header');
const Mustache = require('mustache');
const test = require('ava');
const testRelax = require('../test-relax');
const util = require('util');

async function sleep(ms = 2000) {
    await new Promise(r => setTimeout(r, ms));
}

test('basic post and get', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, status: postStatus } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    t.is(postStatus, 200);
    t.deepEqual(postData, {
        id: postData.id,
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } = await r.get(`/${postData.id}`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        id: postData.id,
        foo: 'fooval',
        bar: 'barval'
    });
}));

test('get - select top level field - dot syntax', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=foo`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        foo: 'fooval'
    });
}));

test('get - select top level field - json ptr syntax',
        cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=/foo`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        foo: 'fooval'
    });
}));

test('get - select embedded field - dot syntax', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        }
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=bar.plugh`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        bar: { plugh: 'waldo' }
    });
}));

test('get - select embedded field - json ptr syntax',
        cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        }
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=/bar/plugh`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        bar: { plugh: 'waldo' }
    });
}));

test('get - select $createdAt, dot syntax', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        }
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=$createdAt`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        $createdAt: new Date(123).toISOString()
    });
}));

test('get - select $createdAt, json ptr syntax', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        }
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=/$createdAt`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        $createdAt: new Date(123).toISOString()
    });
}));

test('get - select $updatedAt', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        }
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=$updatedAt`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        $updatedAt: new Date(123).toISOString()
    });
}));

test('get - select $eTag', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        }
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=$eTag`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        $eTag: JSON.parse(postHeaders.etag)
    });
}));

test('get - select multiple - comma', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        }
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=/bar/plugh,$eTag,foo`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        $eTag: JSON.parse(postHeaders.etag),
        bar: {
            plugh: 'waldo',
        },
        foo: 'fooval'
    });
}));

test('get - select multiple - repeated', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        }
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=/bar/plugh&fields=$eTag,foo`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        $eTag: JSON.parse(postHeaders.etag),
        bar: {
            plugh: 'waldo',
        },
        foo: 'fooval'
    });
}));

test('get - select dollar prefix - dot syntax', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData } = await r.post('/', {
        $createdAt: 'client created at!'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=$$createdAt`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        $createdAt: 'client created at!'
    });
}));

test('get - select dollar prefix - json ptr syntax', cleanAxiosErrors(
        async t => {

    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData } = await r.post('/', {
        $createdAt: 'client created at!'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=/$$createdAt`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        $createdAt: 'client created at!'
    });
}));

test('blah', cleanAxiosErrors(
        async t => {

    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData } = await r.post('/', {
        $createdAt: 'client created at!',
        plugh: 'waldo'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=plugh,$$createdAt:/foo/bar`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        plugh: 'waldo',
        foo: {
            bar: 'client created at!'
        }
    });
}));

test('get - select with remap - dot syntax', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=foo:foo2`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        foo2: 'fooval'
    });
}));

test('get - select with remap - json ptr syntax', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=/foo:/foo2`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        foo2: 'fooval'
    });
}));

test('get - selectageddon', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => 123
        }
    });

    const { data: postData } = await r.post('/', {
        $createdAt: 'client created at!',
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        }
    });

    const remap = '.,.:copy,$createdAt:x,$$createdAt:/copy/plugh';

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}?fields=${remap}`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        id: getData.id,
        $createdAt: 'client created at!',
        foo: 'fooval',
        bar: {
            bazz: 'quuz',
            plugh: 'waldo'
        },
        copy: {
            id: getData.id,
            $createdAt: 'client created at!',
            foo: 'fooval',
            bar: {
                bazz: 'quuz',
                plugh: 'waldo'
            },
            plugh: 'client created at!'
        },
        x: new Date(123).toISOString()
    });
}));

test('basic list', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    await postMany(r, 2, { name: 'doc {{i}}'});

    const { data: listData, headers, status: listStatus } = await r.get('/');

    t.is(headers.Link, undefined);
    t.is(listStatus, 200);

    const listNames = listData.map(({ name }) => name);
    listNames.sort();

    t.deepEqual(listNames, [
        'doc 0', 'doc 1'
    ]);
}));

test('empty list', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: listData, headers, status: listStatus } = await r.get('/');

    t.is(headers.Link, undefined);
    t.is(listStatus, 200);
    t.deepEqual(listData, []);
}));

test('list with default first', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    await postMany(r, 60, { name: 'doc {{i}}'});

    const { data: listData, headers, status: listStatus } = await r.get('/');

    t.is(headers.Link, undefined);
    t.is(listStatus, 200);
    t.deepEqual(listData.length, 50);
}));

test('list with specified first', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    await postMany(r, 30, { name: 'doc {{i}}'});

    const { data: listData, headers, status: listStatus } =
            await r.get('/?first=20');

    t.is(headers.Link, undefined);
    t.is(listStatus, 200);
    t.deepEqual(listData.length, 20);
}));

test('list multiple pages with default first', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    await postMany(r, 160, { name: 'doc {{i}}'});

    // Give the index a sec to catch up.
    await sleep();

    let next = '/';
    let results = [];
    while (next) {
        const { data: listData, headers, status: listStatus } =
                await r.get(next);

        t.is(listStatus, 200);

        results = results.concat(listData);
        next = toRelative(new LinkHeader(headers.link).rel('next')[0]?.uri);
    }

    t.deepEqual(results.length, 160);
}));

test('list multiple pages with specified first', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    await postMany(r, 160, { name: 'doc {{i}}'});

    // Give the index a sec to catch up.
    await sleep();

    let next = '/';
    let results = [];
    while (next) {
        const { data: listData, headers, status: listStatus } =
                await r.get(next, { params: { first: 20 } });

        t.truthy(listData.length <= 20);

        t.is(listStatus, 200);

        results = results.concat(listData);
        next = toRelative(new LinkHeader(headers.link).rel('next')[0]?.uri);
    }

    t.deepEqual(results.length, 160);
}));

test('list multiple pages with specified order', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: 'thing 7' });
    await r.post('/', { name: 'thing 3' });
    await r.post('/', { name: 'thing 8' });
    await r.post('/', { name: 'thing 2' });
    await r.post('/', { name: 'thing 6' });
    await r.post('/', { name: 'thing 4' });
    await r.post('/', { name: 'thing 1' });
    await r.post('/', { name: 'thing 9' });
    await r.post('/', { name: 'thing 0' });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', { params: { order: 'byName' } });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [
        'thing 0', 'thing 1', 'thing 2', 'thing 3', 'thing 4', 'thing 5',
        'thing 6', 'thing 7', 'thing 8', 'thing 9'
    ]);
}));

test('default filter <', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: 'thing 7' });
    await r.post('/', { name: 'thing 3' });
    await r.post('/', { name: 'thing 8' });
    await r.post('/', { name: 'thing 2' });
    await r.post('/', { name: 'thing 6' });
    await r.post('/', { name: 'thing 4' });
    await r.post('/', { name: 'thing 1' });
    await r.post('/', { name: 'thing 9' });
    await r.post('/', { name: 'thing 0' });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: 'name<thing 5',
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [
        'thing 0', 'thing 1', 'thing 2', 'thing 3', 'thing 4'
    ]);
}));

test('default filter <=', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: 'thing 7' });
    await r.post('/', { name: 'thing 3' });
    await r.post('/', { name: 'thing 8' });
    await r.post('/', { name: 'thing 2' });
    await r.post('/', { name: 'thing 6' });
    await r.post('/', { name: 'thing 4' });
    await r.post('/', { name: 'thing 1' });
    await r.post('/', { name: 'thing 9' });
    await r.post('/', { name: 'thing 0' });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: 'name<=thing 5',
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [
        'thing 0', 'thing 1', 'thing 2', 'thing 3', 'thing 4', 'thing 5'
    ]);
}));

test('default filter =', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: 'thing 7' });
    await r.post('/', { name: 'thing 3' });
    await r.post('/', { name: 'thing 8' });
    await r.post('/', { name: 'thing 2' });
    await r.post('/', { name: 'thing 6' });
    await r.post('/', { name: 'thing 4' });
    await r.post('/', { name: 'thing 1' });
    await r.post('/', { name: 'thing 9' });
    await r.post('/', { name: 'thing 0' });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: 'name=thing 5',
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), ['thing 5']);
}));

test('default filter >=', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: 'thing 7' });
    await r.post('/', { name: 'thing 3' });
    await r.post('/', { name: 'thing 8' });
    await r.post('/', { name: 'thing 2' });
    await r.post('/', { name: 'thing 6' });
    await r.post('/', { name: 'thing 4' });
    await r.post('/', { name: 'thing 1' });
    await r.post('/', { name: 'thing 9' });
    await r.post('/', { name: 'thing 0' });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: 'name>=thing 5',
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [
        'thing 5', 'thing 6', 'thing 7', 'thing 8', 'thing 9'
    ]);
}));

test('default filter >', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: 'thing 7' });
    await r.post('/', { name: 'thing 3' });
    await r.post('/', { name: 'thing 8' });
    await r.post('/', { name: 'thing 2' });
    await r.post('/', { name: 'thing 6' });
    await r.post('/', { name: 'thing 4' });
    await r.post('/', { name: 'thing 1' });
    await r.post('/', { name: 'thing 9' });
    await r.post('/', { name: 'thing 0' });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: 'name>thing 5',
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [
        'thing 6', 'thing 7', 'thing 8', 'thing 9'
    ]);
}));

test('multiple filters - comma', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: 'thing 7' });
    await r.post('/', { name: 'thing 3' });
    await r.post('/', { name: 'thing 8' });
    await r.post('/', { name: 'thing 2' });
    await r.post('/', { name: 'thing 6' });
    await r.post('/', { name: 'thing 4' });
    await r.post('/', { name: 'thing 1' });
    await r.post('/', { name: 'thing 9' });
    await r.post('/', { name: 'thing 0' });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: 'name<=thing 5,name>thing 1',
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [
        'thing 2', 'thing 3', 'thing 4', 'thing 5'
    ]);
}));

test('multiple filters - repeated param', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: 'thing 7' });
    await r.post('/', { name: 'thing 3' });
    await r.post('/', { name: 'thing 8' });
    await r.post('/', { name: 'thing 2' });
    await r.post('/', { name: 'thing 6' });
    await r.post('/', { name: 'thing 4' });
    await r.post('/', { name: 'thing 1' });
    await r.post('/', { name: 'thing 9' });
    await r.post('/', { name: 'thing 0' });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } = await r.get(
            '/?order=byName&filter=name<=thing 5&filter=name>thing 1');

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [
        'thing 2', 'thing 3', 'thing 4', 'thing 5'
    ]);
}));

test('filter keys and values uri decoded', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { '{"}': 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { '{"}': '{"} 5' });
    await r.post('/', { '{"}': '{"} 7' });
    await r.post('/', { '{"}': '{"} 3' });
    await r.post('/', { '{"}': '{"} 8' });
    await r.post('/', { '{"}': '{"} 2' });
    await r.post('/', { '{"}': '{"} 6' });
    await r.post('/', { '{"}': '{"} 4' });
    await r.post('/', { '{"}': '{"} 1' });
    await r.post('/', { '{"}': '{"} 9' });
    await r.post('/', { '{"}': '{"} 0' });

    // Give the index a sec to catch up.
    await sleep();

    const encoded = encodeURIComponent('{"}');

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: `${encoded}>${encoded} 5`,
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(doc => doc['{"}']), [
        '{"} 6', '{"} 7', '{"} 8', '{"} 9'
    ]);
}));

test('default parseValue - null', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: null });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: 'name=null',
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [ null ]);
}));

test('default parseValue - true', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: true });
    await r.post('/', { name: false });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: 'name=true',
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [ true ]);
}));

test('default parseValue - false', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byName: {
                    fields: [
                        { name: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { name: 'thing 5' });
    await r.post('/', { name: true });
    await r.post('/', { name: false });

    // Give the index a sec to catch up.
    await sleep();

    const { data: listData, headers, status: listStatus } =
            await r.get('/', {
                params: {
                    filter: 'name=false',
                    order: 'byName'
                }
            });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ name }) => name), [ false ]);
}));

test('filter by $createdAt + default parseValue - date',
        cleanAxiosErrors(async t => {
    let now = (new Date('2000-01-01T12:00:00Z')).valueOf();
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => now
        }
    });

    await r.post('/', { index: 1 });

    now = (new Date('2000-01-02T12:00:00Z')).valueOf();
    await r.post('/', { index: 2 });

    now = (new Date('2000-01-03T12:00:00Z')).valueOf();
    await r.post('/', { index: 3 });

    now = (new Date('2000-01-04T12:00:00Z')).valueOf();
    await r.post('/', { index: 4 });

    now = (new Date('2000-01-05T12:00:00Z')).valueOf();
    await r.post('/', { index: 5 });

    // Give the index a sec to catch up.
    await sleep();

    let { data: listData, headers, status: listStatus } = await r.get('/', {
        params: {
            filter: '$createdAt>2000-01-03T12:00:00Z'
        }
    });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ index }) => index), [ 4, 5 ]);
}));

test('default parseValue - number', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byAmplitude: {
                    fields: [
                        { amplitude: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { amplitude: 0.5 });
    await r.post('/', { amplitude: 1 });
    await r.post('/', { amplitude: 1.5 });
    await r.post('/', { amplitude: 2 });
    await r.post('/', { amplitude: 2.5 });
    await r.post('/', { amplitude: 3 });
    await r.post('/', { amplitude: 3.5 });
    await r.post('/', { amplitude: 4 });
    await r.post('/', { amplitude: 4.5 });
    await r.post('/', { amplitude: 5 });

    // Give the index a sec to catch up.
    await sleep();

    let { data: listData, headers, status: listStatus } = await r.get('/', {
        params: {
            filter: 'amplitude>1.5',
            order: 'byAmplitude'
        }
    });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ amplitude }) => amplitude), [
        2, 2.5, 3, 3.5, 4, 4.5, 5
    ]);

    ({ data: listData, headers, status: listStatus } = await r.get('/', {
        params: {
            filter: 'amplitude>2',
            order: 'byAmplitude'
        }
    }));

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ amplitude }) => amplitude), [
        2.5, 3, 3.5, 4, 4.5, 5
    ]);

    ({ data: listData, headers, status: listStatus } = await r.get('/', {
        params: {
            filter: 'amplitude>.5',
            order: 'byAmplitude'
        }
    }));

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ amplitude }) => amplitude), [
        1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5
    ]);
}));

test('filter by $updatedAt + default parseValue - date',
        cleanAxiosErrors(async t => {
    let now = (new Date('2000-01-01T12:00:00Z')).valueOf();
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            nower: () => now,
            orderings: {
                byUpdatedAt: {
                    fields: [
                        { $updatedAt: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', { index: 1 });

    now = (new Date('2000-01-02T12:00:00Z')).valueOf();
    await r.post('/', { index: 2 });

    now = (new Date('2000-01-03T12:00:00Z')).valueOf();
    await r.post('/', { index: 3 });

    now = (new Date('2000-01-04T12:00:00Z')).valueOf();
    await r.post('/', { index: 4 });

    now = (new Date('2000-01-05T12:00:00Z')).valueOf();
    await r.post('/', { index: 5 });

    // Give the index a sec to catch up.
    await sleep();

    let { data: listData, headers, status: listStatus } = await r.get('/', {
        params: {
            order: 'byUpdatedAt',
            filter: '$updatedAt>2000-01-03T12:00:00Z'
        }
    });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ index }) => index), [ 4, 5 ]);
}));

test('filter by $eTag', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            orderings: {
                byETag: {
                    fields: [
                        { $eTag: 1 }
                    ]
                }
            }
        }
    });

    await r.post('/', {});
    const { headers } = await r.post('/', {});
    await r.post('/', {});

    // Give the index a sec to catch up.
    await sleep();

    let { data: listData, status: listStatus } = await r.get('/', {
        params: {
            order: 'byETag',
            filter: `$eTag=${JSON.parse(headers.etag)}`
        }
    });

    t.is(listStatus, 200);
    t.is(listData.length, 1);
}));

test('filter by id', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            parseUrlId: x => x,
            toDb: x => x
        }
    });

    await r.put('/a', {});
    await r.put('/b', {});
    await r.put('/c', {});
    await r.put('/d', {});
    await r.put('/e', {});

    // Give the index a sec to catch up.
    await sleep();

    let { data: listData, status: listStatus } = await r.get('/', {
        params: {
            filter: `id>=b,id<e`
        }
    });

    t.is(listStatus, 200);
    t.deepEqual(listData.map(({ id }) => id ), [ 'b', 'c', 'd' ]);
}));

test('get - not found', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc',
            parseUrlId: x => x,
            toDb: x => x
        }
    });

    const e = await t.throwsAsync(r.get(`/nonesuch`));

    t.is(e.response.status, 404);
}));

test('get - if-match 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}`, {
        headers: {
            'If-Match': postHeaders.etag
        }
    });

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        id: postData.id,
        foo: 'fooval',
        bar: 'barval'
    });
}));

test('get - if-match star 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}`, {
        headers: {
            'If-Match': '*'
        }
    });

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        id: postData.id,
        foo: 'fooval',
        bar: 'barval'
    });
}));

test('get - if-match weak -> 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.get(`/${postData.id}`, {
        headers: {
            'If-Match': `W/${postHeaders.etag}`
        }
    }));

    t.is(error.response.status, 412);
}));

test('get - if-match multiple 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}`, {
        headers: {
            'If-Match': `"something", ${postHeaders.etag}, "somethingelse"`
        }
    });

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        id: postData.id,
        foo: 'fooval',
        bar: 'barval'
    });
}));

test('get - if-match 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.get(`/${postData.id}`, {
        headers: {
            'If-Match': '"somethingelse"'
        }
    }));

    t.is(error.response.status, 412);
}));

test('get - if-none-match 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } =
            await r.get(`/${postData.id}`, {
        headers: {
            'If-None-Match': '"somethingelse"'
        }
    });

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        id: postData.id,
        foo: 'fooval',
        bar: 'barval'
    });
}));

test('get - if-none-match 304', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.get(`/${postData.id}`, {
        headers: {
            'If-None-Match': postHeaders.etag
        }
    }));

    t.is(error.response.status, 304);
}));

test('get - if-none-match multiple', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.get(`/${postData.id}`, {
        headers: {
            'If-None-Match': `"something", ${postHeaders.etag}, "somethingelse"`
        }
    }));

    t.is(error.response.status, 304);
}));

test('get - if-none-match weak 304', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.get(`/${postData.id}`, {
        headers: {
            'If-None-Match': `W/${postHeaders.etag}`
        }
    }));

    t.is(error.response.status, 304);
}));

test('get - if-none-match star 304', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.get(`/${postData.id}`, {
        headers: {
            'If-None-Match': '*'
        }
    }));

    t.is(error.response.status, 304);
}));

test('basic post, patch, and get', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: patchData, status: patchStatus } =
            await r.patch(`/${postData.id}`, [
                { op: 'replace', path: '/foo', value: { waldo: 'plugh' }},
                { op: 'remove', path: '/bar' },
                { op: 'add', path: '/bazz', value: 'bazzval'}
            ], {
                headers: {
                    'Content-Type': 'application/json-patch+json'
                }
            });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        foo: { waldo: 'plugh' },
        bazz: 'bazzval'
    });

    const { data: getData, status: getStatus } = await r.get(`/${postData.id}`);

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        id: postData.id,
        foo: { waldo: 'plugh' },
        bazz: 'bazzval'
    });
}));

test('patch - if-match 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: patchData, status: patchStatus } =
            await r.patch(`/${postData.id}`, [
                { op: 'replace', path: '/foo', value: 'fooval2' }
            ],
            {
                headers: {
                    'Content-Type': 'application/json-patch+json',
                    'If-Match': postHeaders.etag
                }
            });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        foo: 'fooval2',
        bar: 'barval'
    });
}));

test('patch - if-match star 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: patchData, status: patchStatus } =
            await r.patch(`/${postData.id}`, [
                { op: 'replace', path: '/foo', value: 'fooval2' }
            ],
            {
                headers: {
                    'Content-Type': 'application/json-patch+json',
                    'If-Match': '*'
                }
            });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        foo: 'fooval2',
        bar: 'barval'
    });
}));

test('patch - if-match weak -> 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.patch(`/${postData.id}`,
        [
            { op: 'replace', path: '/foo', value: 'fooval2' }
        ],
        {
            headers: {
                'Content-Type': 'application/json-patch+json',
                'If-Match': `W/${postHeaders.etag}`
            }
        }
    ));

    t.is(error.response.status, 412);
}));

test('patch - if-match multiple 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: patchData, status: patchStatus } =
            await r.patch(`/${postData.id}`, [
                { op: 'replace', path: '/foo', value: 'fooval2' }
            ],
            {
                headers: {
                    'Content-Type': 'application/json-patch+json',
                    'If-Match': `"thing", ${postHeaders.etag}, "otherthing"`
                }
            });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        foo: 'fooval2',
        bar: 'barval'
    });
}));

test('patch - if-match 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.patch(`/${postData.id}`,
        [
            { op: 'replace', path: '/foo', value: 'fooval2' }
        ],
        {
            headers: {
                'Content-Type': 'application/json-patch+json',
                'If-Match': '"somethingelse"'
            }
        }));

    t.is(error.response.status, 412);
}));

test('patch - if-none-match 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: patchData, status: patchStatus } =
            await r.patch(`/${postData.id}`,
                [
                    { op: 'replace', path: '/foo', value: 'fooval2' }
                ],
                {
                    headers: {
                        'Content-Type': 'application/json-patch+json',
                        'If-None-Match': '"somethingelse"'
                    }
                });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        foo: 'fooval2',
        bar: 'barval'
    });
}));

test('patch - if-none-match 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.patch(`/${postData.id}`,
            [
                { op: 'replace', path: '/foo', value: 'fooval2' }
            ],
            {
                headers: {
                    'Content-Type': 'application/json-patch+json',
                    'If-None-Match': postHeaders.etag
                }
            }));

    t.is(error.response.status, 412);
}));

test('patch - if-none-match multiple', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.patch(`/${postData.id}`,
            [
                { op: 'replace', path: '/foo', value: 'fooval2' }
            ],
            {
                headers: {
                    'Content-Type': 'application/json-patch+json',
                    'If-None-Match':
                            `"something", ${postHeaders.etag}, "somethingelse"`
                }
            }));

    t.is(error.response.status, 412);
}));

test('patch - if-none-match weak 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.patch(`/${postData.id}`,
            [
                { op: 'replace', path: '/foo', value: 'fooval2' }
            ],
            {
                headers: {
                    'Content-Type': 'application/json-patch+json',
                    'If-None-Match': `W/${postHeaders.etag}`
                }
            }));

    t.is(error.response.status, 412);
}));

test('patch - if-none-match star 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.patch(`/${postData.id}`, [
                { op: 'replace', path: '/foo', value: 'fooval2' }
            ],
            {
                headers: {
                    'Content-Type': 'application/json-patch+json',
                    'If-None-Match': '*'
                }
            }));

    t.is(error.response.status, 412);
}));

test('basic put and get', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc',
            parseUrlId: x => x,
            toDb: x => x
        }
    });

    const { data: putData, status: putStatus } = await r.put('/abc', {
        foo: 'fooval',
        bar: 'barval'
    });

    t.is(putStatus, 200);
    t.deepEqual(putData, {
        id: 'abc',
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: getData, status: getStatus } = await r.get('/abc');

    t.is(getStatus, 200);
    t.deepEqual(getData, {
        id: 'abc',
        foo: 'fooval',
        bar: 'barval'
    });
}));

test('put - if-match 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: patchData, status: patchStatus } =
            await r.put(`/${postData.id}`, {
                foo: 'fooval2',
                bar: 'barval2'
            },
            {
                headers: {
                    'If-Match': postHeaders.etag
                }
            });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        foo: 'fooval2',
        bar: 'barval2'
    });
}));

test('put - if-match star 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: patchData, status: patchStatus } =
            await r.put(`/${postData.id}`, {
                foo: 'fooval2',
                bar: 'barval2'
            },
            {
                headers: {
                    'If-Match': '*'
                }
            });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        foo: 'fooval2',
        bar: 'barval2'
    });
}));

test('put - if-match weak -> 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.put(`/${postData.id}`,
        {
            foo: 'fooval2',
            bar: 'barval2'
        },
        {
            headers: {
                'If-Match': `W/${postHeaders.etag}`
            }
        }
    ));

    t.is(error.response.status, 412);
}));

test('put - if-match multiple 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: patchData, status: patchStatus } =
            await r.put(`/${postData.id}`, {
                foo: 'fooval2',
                bar: 'barval2'
            },
            {
                headers: {
                    'If-Match': `"thing", ${postHeaders.etag}, "otherthing"`
                }
            });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        foo: 'fooval2',
        bar: 'barval2'
    });
}));

test('put - if-match 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.put(`/${postData.id}`,
        {
            foo: 'fooval2',
            bar: 'barval2'
        },
        {
            headers: {
                'If-Match': '"somethingelse"'
            }
        }));

    t.is(error.response.status, 412);
}));

test('put - if-none-match 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: patchData, status: patchStatus } =
            await r.put(`/${postData.id}`,
                {
                    foo: 'fooval2',
                    bar: 'barval2'
                },
                {
                    headers: {
                        'If-None-Match': '"somethingelse"'
                    }
                });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        foo: 'fooval2',
        bar: 'barval2'
    });
}));

test('put - if-none-match 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.put(`/${postData.id}`,
            {
                foo: 'fooval',
                bar: 'barval'
            },
            {
                headers: {
                    'If-None-Match': postHeaders.etag
                }
            }));

    t.is(error.response.status, 412);
}));

test('put - if-none-match multiple', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.put(`/${postData.id}`,
            {
                foo: 'fooval2',
                bar: 'barval2'
            },
            {
                headers: {
                    'If-None-Match':
                            `"something", ${postHeaders.etag}, "somethingelse"`
                }
            }));

    t.is(error.response.status, 412);
}));

test('put - if-none-match weak 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.put(`/${postData.id}`,
            {
                foo: 'fooval2',
                bar: 'barval2'
            },
            {
                headers: {
                    'If-None-Match': `W/${postHeaders.etag}`
                }
            }));

    t.is(error.response.status, 412);
}));

test('put - if-none-match star 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.put(`/${postData.id}`,
            {
                foo: 'fooval2',
                bar: 'barval2'
            },
            {
                headers: {
                    'If-None-Match': '*'
                }
            }));

    t.is(error.response.status, 412);
}));

test('put - if-none-match star + nothing -> 200', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc',
            parseUrlId: x => x,
            toDb: x => x
        }
    });

    const { data: patchData, status: patchStatus } =
            await r.put(`/abc`,
                {
                    foo: 'fooval2',
                    bar: 'barval2'
                },
                {
                    headers: {
                        'If-None-Match': '*'
                    }
                });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: 'abc',
        foo: 'fooval2',
        bar: 'barval2'
    });
}));

test('basic post and delete', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    await r.delete(`/${postData.id}`);

    const e = await t.throwsAsync(r.get(`/${postData.id}`));

    t.is(e.response.status, 404);
}));

test('delete - if-match 204', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: deleteData, status: deleteStatus } =
            await r.delete(`/${postData.id}`, {
        headers: {
            'If-Match': postHeaders.etag
        }
    });

    t.is(deleteStatus, 204);
}));

test('delete - if-match star 204', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: deleteData, status: deleteStatus } =
            await r.delete(`/${postData.id}`, {
        headers: {
            'If-Match': '*'
        }
    });

    t.is(deleteStatus, 204);
}));

test('delete - if-match weak -> 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.delete(`/${postData.id}`, {
        headers: {
            'If-Match': `W/${postHeaders.etag}`
        }
    }));

    t.is(error.response.status, 412);
}));

test('delete - if-match multiple 204', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: deleteData, status: deleteStatus } =
            await r.delete(`/${postData.id}`, {
        headers: {
            'If-Match': `"something", ${postHeaders.etag}, "somethingelse"`
        }
    });

    t.is(deleteStatus, 204);
}));

test('delete - if-match 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.delete(`/${postData.id}`, {
        headers: {
            'If-Match': '"somethingelse"'
        }
    }));

    t.is(error.response.status, 412);
}));

test('delete - if-none-match 204', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const { data: deleteData, status: deleteStatus } =
            await r.delete(`/${postData.id}`, {
        headers: {
            'If-None-Match': '"somethingelse"'
        }
    });

    t.is(deleteStatus, 204);
}));

test('delete - if-none-match 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.delete(`/${postData.id}`, {
        headers: {
            'If-None-Match': postHeaders.etag
        }
    }));

    t.is(error.response.status, 412);
}));

test('delete - if-none-match multiple', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.delete(`/${postData.id}`, {
        headers: {
            'If-None-Match': `"something", ${postHeaders.etag}, "somethingelse"`
        }
    }));

    t.is(error.response.status, 412);
}));

test('delete - if-none-match weak 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.delete(`/${postData.id}`, {
        headers: {
            'If-None-Match': `W/${postHeaders.etag}`
        }
    }));

    t.is(error.response.status, 412);
}));

test('delete - if-none-match star 412', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {});

    const { data: postData, headers: postHeaders } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    const error = await t.throwsAsync(r.delete(`/${postData.id}`, {
        headers: {
            'If-None-Match': '*'
        }
    }));

    t.is(error.response.status, 412);
}));

// 1) Are fromDb and toDb firing and doing their jobs?
// 2) ...does that include auto toJSON()?
// 3)

test('fromDb + toDb', cleanAxiosErrors(async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            fromDb: db => ({
                ...db,
                someDate1: db.someDate1.valueOf(),
                // We leave someDate2 to be coerced automatically by toJSON(),
                // which should result in an ISO 8601 string alongside
                // someDate1's unix timestamp (both acceptable to new Date(x)
                // in toDb() below).
            }),
            toDb: ent => ({
                ...ent,

                someDate1: new Date(ent.someDate1),
                someDate2: new Date(ent.someDate2)
            }),
            orderings: {
                test: {
                    fields: [
                        { $updatedAt: 1 }
                    ],
                    filters: {
                        type: {
                            operators: {
                                eq: {
                                    toMongo: v => {
                                        const [field, type] = v.split('=');
                                        return { [field]: { $type: type } };
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const { data: postData } = await r.post('/', {
        someDate1: '2020-01-01T12:00:00Z',
        someDate2: '2020-01-02T12:00:00Z',
    });

    t.deepEqual(postData, {
        id: postData.id,
        someDate1: 1577880000000,
        someDate2: '2020-01-02T12:00:00.000Z'
    });

    const { data: listData1, status: listStatus1 } =
            await r.get('/', {
                params: {
                    filter: `type=${encodeURIComponent('someDate1=date')}`,
                    order: 'test'
                }
            });

    t.deepEqual(listData1, [{
        id: postData.id,
        someDate1: 1577880000000,
        someDate2: '2020-01-02T12:00:00.000Z'
    }]);

    const { data: listData2, status: listStatus2 } =
            await r.get('/', {
                params: {
                    filter: `type=${encodeURIComponent('someDate2=date')}`,
                    order: 'test'
                }
            });

    t.deepEqual(listData2, [{
        id: postData.id,
        someDate1: 1577880000000,
        someDate2: '2020-01-02T12:00:00.000Z'
    }]);

    const { data: patchData, status: patchStatus } =
            await r.patch(`/${postData.id}`, [
                { op: 'copy', from: '/someDate1', path: '/someDate3' },
                { op: 'copy', from: '/someDate2', path: '/someDate4' }
            ], {
                headers: {
                    'Content-Type': 'application/json-patch+json'
                }
            });

    t.is(patchStatus, 200);
    t.deepEqual(patchData, {
        id: postData.id,
        someDate1: 1577880000000,
        someDate2: '2020-01-02T12:00:00.000Z',
        someDate3: 1577880000000,
        someDate4: '2020-01-02T12:00:00.000Z',
    });

    const { data: listData3, status: listStatus3 } =
            await r.get('/', {
                params: {
                    filter: `type=${encodeURIComponent('someDate1=date')}`,
                    order: 'test'
                }
            });

    t.is(patchStatus, 200);
    t.deepEqual(listData3, [{
        id: postData.id,
        someDate1: 1577880000000,
        someDate2: '2020-01-02T12:00:00.000Z',
        someDate3: 1577880000000,
        someDate4: '2020-01-02T12:00:00.000Z',
    }]);

    const { data: listData4, status: listStatus4 } =
            await r.get('/', {
                params: {
                    filter: `type=${encodeURIComponent('someDate2=date')}`,
                    order: 'test'
                }
            });

    t.is(listStatus4, 200);
    t.deepEqual(listData4, [{
        id: postData.id,
        someDate1: 1577880000000,
        someDate2: '2020-01-02T12:00:00.000Z',
        someDate3: 1577880000000,
        someDate4: '2020-01-02T12:00:00.000Z',
    }]);

    const { data: listData5, status: listStatus5 } =
            await r.get('/', {
                params: {
                    filter: `type=${encodeURIComponent('someDate3=double')}`,
                    order: 'test'
                }
            });

    t.is(listStatus5, 200);
    t.deepEqual(listData5, [{
        id: postData.id,
        someDate1: 1577880000000,
        someDate2: '2020-01-02T12:00:00.000Z',
        someDate3: 1577880000000,
        someDate4: '2020-01-02T12:00:00.000Z',
    }]);

    const { data: listData6, status: listStatus6 } =
            await r.get('/', {
                params: {
                    filter: `type=${encodeURIComponent('someDate4=string')}`,
                    order: 'test'
                }
            });

    t.is(listStatus6, 200);
    t.deepEqual(listData6, [{
        id: postData.id,
        someDate1: 1577880000000,
        someDate2: '2020-01-02T12:00:00.000Z',
        someDate3: 1577880000000,
        someDate4: '2020-01-02T12:00:00.000Z',
    }]);
}));

function cleanAxiosErrors(fn) {
    return async t => {
        let result;
        try {
            result = await fn(t);
        }
        catch (e) {
            if (e.isAxiosError) {
                const cleanError = new Error(e.message);
                cleanError.request = {
                    headers: e.config.headers,
                    method: e.request.method,
                    path: e.request.path
                };
                cleanError.response = {
                    data: e.response.data,
                    headers: e.response.headers,
                    status: e.response.status,
                };
                throw cleanError;
            }

            throw e;
        }

        return result;
    };
}

async function postMany(relax, count, template, op) {
    if (!op) {
        op = doc => relax.post('/', doc);
    }

    const promises = [];
    for (let i = 0; i < count; i++) {
        promises.push(op(templateObj(template, { i }), i));
    }

    await Promise.all(promises);
}

function templateObj(o, data) {
    return Object.fromEntries(Object.entries(o).map(
        ([key, value]) => typeof value === 'string'
                ? ([key, Mustache.render(value, data)])
                : value
    ));
}

function toRelative(href) {
    if (!href) {
        return;
    }

    const url = new URL(href);
    return url.pathname + url.search;
}
