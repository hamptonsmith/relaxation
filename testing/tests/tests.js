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
    t.timeout(40000);
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

test('get - not found', async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc',
            parseUrlId: x => x
        }
    });

    const e = await t.throwsAsync(r.get(`/nonesuch`));

    t.is(e.response.status, 404);
});

test('get - if-match 200', async t => {
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
});

test('get - if-match star 200', async t => {
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
});

test('get - if-match weak -> 412', async t => {
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
});

test('get - if-match multiple 200', async t => {
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
});

test('get - if-match 412', async t => {
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
});

test('get - if-none-match 200', async t => {
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
});

test('get - if-none-match 304', async t => {
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
});

test('get - if-none-match multiple', async t => {
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
});

test('get - if-none-match weak 304', async t => {
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
});

test('get - if-none-match star 304', async t => {
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
});

test('basic post, patch, and get', async t => {
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
});

test('patch - if-match 200', async t => {
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
});

test('patch - if-match star 200', async t => {
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
});

test('patch - if-match weak -> 412', async t => {
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
});

test('patch - if-match multiple 200', async t => {
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
});

test('patch - if-match 412', async t => {
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
});

test('patch - if-none-match 200', async t => {
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
});

test('patch - if-none-match 412', async t => {
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
});

test('patch - if-none-match multiple', async t => {
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
});

test('patch - if-none-match weak 412', async t => {
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
});

test('patch - if-none-match star 412', async t => {
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
});

test('basic put and get', async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc',
            parseUrlId: x => x
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
});

test('put - if-match 200', async t => {
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
});

test('put - if-match star 200', async t => {
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
});

test('put - if-match weak -> 412', async t => {
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
});

test('put - if-match multiple 200', async t => {
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
});

test('put - if-match 412', async t => {
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
});

test('put - if-none-match 200', async t => {
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
});

test('put - if-none-match 412', async t => {
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
});

test('put - if-none-match multiple', async t => {
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
});

test('put - if-none-match weak 412', async t => {
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
});

test('put - if-none-match star 412', async t => {
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
});

test('put - if-none-match star + nothing -> 200', async t => {
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc',
            parseUrlId: x => x
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
});

test('basic post and delete', async t => {
    const r = await testRelax(t, () => {});

    const { data: postData } = await r.post('/', {
        foo: 'fooval',
        bar: 'barval'
    });

    await r.delete(`/${postData.id}`);

    const e = await t.throwsAsync(r.get(`/${postData.id}`));

    t.is(e.response.status, 404);
});

test('delete - if-match 204', async t => {
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
});

test('delete - if-match star 204', async t => {
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
});

test('delete - if-match weak -> 412', async t => {
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
});

test('delete - if-match multiple 204', async t => {
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
});

test('delete - if-match 412', async t => {
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
});

test('delete - if-none-match 204', async t => {
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
});

test('delete - if-none-match 412', async t => {
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
});

test('delete - if-none-match multiple', async t => {
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
});

test('delete - if-none-match weak 412', async t => {
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
});

test('delete - if-none-match star 412', async t => {
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
});

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

async function postMany(relax, count, template) {
    const promises = [];
    for (let i = 0; i < count; i++) {
        promises.push(relax.post('/', templateObj(template, { i })));
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
