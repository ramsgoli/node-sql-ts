'use strict';

import { equal, throws } from 'assert';
import { Sql } from '../lib';

const sql = new Sql();

suite('column', function() {
    const table = sql.define<{ id: number; created: boolean; alias: string }>({
        name: 'user',
        columns: ['id', 'created', 'alias']
    });

    test('can be accessed by property and array', function() {
        equal(table.created, table.columns[1], 'should be able to access created both by array and property');
    });

    suite('toQuery()', function() {
        test('works', function() {
            equal(table.id.toQuery().text, '"user"."id"');
        });

        test('works with a column name of "alias"', function() {
            equal(table.alias.toQuery().text, '"user"."alias"');
        });

        test('respects AS rename', function() {
            equal(table.id.as('userId').toQuery().text, '"user"."id" AS "userId"');
        });

        test('respects count and distinct', function() {
            equal(
                table.id
                    .count()
                    .distinct()
                    .as('userIdCount')
                    .toQuery().text,
                'COUNT(DISTINCT("user"."id")) AS "userIdCount"'
            );
        });

        suite('in subquery with min', function() {
            const subquery = table.subQuery('subTable').select(table.id.min().as('subId'));
            const col = subquery.subId.toQuery().text;
            equal(col, '"subTable"."subId"');
        });

        suite('property', function() {
            const table = sql.define<{ propertyName: string }>({
                name: 'roundtrip',
                columns: {
                    column_name: { property: 'propertyName' }
                }
            });
            test('used as alias when !== column name', function() {
                equal(table.propertyName.toQuery().text, '"roundtrip"."column_name" AS "propertyName"');
            });
            test('uses explicit alias when !== column name', function() {
                equal(table.propertyName.as('alias').toQuery().text, '"roundtrip"."column_name" AS "alias"');
            });
            test('maps to column name in insert', function() {
                equal(table.insert({ propertyName: 'propVal' }).toQuery().text, 'INSERT INTO "roundtrip" ("column_name") VALUES ($1)');
            });
            test('maps to column name in update', function() {
                equal(table.update({ propertyName: 'propVal' }).toQuery().text, 'UPDATE "roundtrip" SET "column_name" = $1');
            });
            test('explicitly selected by *', function() {
                equal(
                    table
                        .select(table.star())
                        .from(table)
                        .toQuery().text,
                    'SELECT "roundtrip"."column_name" AS "propertyName" FROM "roundtrip"'
                );
            });
        });

        suite('autoGenerate', function() {
            const table = sql.define({
                name: 'ag',
                columns: {
                    id: { autoGenerated: true },
                    name: {}
                }
            });
            test('does not include auto generated columns in insert', function() {
                equal(table.insert({ id: 0, name: 'name' }).toQuery().text, 'INSERT INTO "ag" ("name") VALUES ($1)');
            });
            test('does not include auto generated columns in update', function() {
                equal(table.update({ id: 0, name: 'name' }).toQuery().text, 'UPDATE "ag" SET "name" = $1');
            });
        });

        suite('white listed', function() {
            const table = sql.define({
                name: 'wl',
                columnWhiteList: true,
                columns: ['id', 'name']
            });
            test('excludes insert properties that are not a column', function() {
                equal(
                    table.insert({ id: 0, _private: '_private', name: 'name' }).toQuery().text,
                    'INSERT INTO "wl" ("id", "name") VALUES ($1, $2)'
                );
            });
            test('excludes update properties that are not a column', function() {
                // for testing purposes ignore the compile-time error
                //@ts-ignore
                equal(table.update({ id: 0, _private: '_private', name: 'name' }).toQuery().text, 'UPDATE "wl" SET "id" = $1, "name" = $2');
            });
        });

        suite('not white listed', function() {
            const table = sql.define({
                name: 'wl',
                columns: ['id', 'name']
            });
            test('throws for insert properties that are not a column', function() {
                throws(function() {
                    table.insert({ id: 0, _private: '_private', name: 'name' });
                }, Error);
            });
            test('throws for update properties that are not a column', function() {
                throws(function() {
                    // for testing purposes ignore the compile-time error
                    //@ts-ignore
                    table.update({ id: 0, _private: '_private', name: 'name' });
                }, Error);
            });
        });

        suite('snake to camel', function() {
            const table = sql.define<{ makeMeCamel: number; not2Cam: string }>({
                name: 'sc',
                snakeToCamel: true,
                columns: {
                    make_me_camel: {},
                    not_to_camel: { property: 'not2Cam' }
                }
            });
            test('for snake column names with no explicit property name', function() {
                equal(table.makeMeCamel.toQuery().text, '"sc"."make_me_camel" AS "makeMeCamel"');
            });
            test('but not when with explicit property name', function() {
                equal(table.not2Cam.toQuery().text, '"sc"."not_to_camel" AS "not2Cam"');
            });
            test('does not use property alias within CASE ... END', function() {
                equal(
                    table.makeMeCamel
                        .case([table.makeMeCamel.equals(0)], [table.makeMeCamel])
                        .as('rename')
                        .toQuery().text,
                    '(CASE WHEN ("sc"."make_me_camel" = $1) THEN "sc"."make_me_camel" END) AS "rename"'
                );
            });
            test('respects AS rename in RETURNING clause', function() {
                equal(
                    table
                        .update({ makeMeCamel: 0 })
                        .returning(table.makeMeCamel.as('rename'))
                        .toQuery().text,
                    'UPDATE "sc" SET "make_me_camel" = $1 RETURNING "make_me_camel" AS "rename"'
                );
            });
        });
    });
});
