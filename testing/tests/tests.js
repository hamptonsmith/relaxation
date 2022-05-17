'use strict';

const test = require('ava');
const testRelax = require('../test-relax');

test('basic post and get', async t => {
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
    const r = await testRelax(t, () => {});

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
    const r = await testRelax(t, () => {}, {
        constructorOpts: {
            generateId: () => 'abc'
        }
    });

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
            generateId: () => 'abc'
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
