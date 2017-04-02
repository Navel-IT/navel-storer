/*
    Copyright (C) 2015-2017 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const
    db = require('@arangodb').db,
    oCollectionName = module.context.collectionName('o'),
    dCollectionName = module.context.collectionName('d'),
    ooCollectionName = module.context.collectionName('oo'),
    odCollectionName = module.context.collectionName('od')
    aCollectionName = module.context.collectionName('a');

if ( ! db._collection(oCollectionName)) db._createDocumentCollection(oCollectionName);
if ( ! db._collection(dCollectionName)) db._createDocumentCollection(dCollectionName);
if ( ! db._collection(ooCollectionName)) db._createEdgeCollection(ooCollectionName);
if ( ! db._collection(odCollectionName)) db._createEdgeCollection(odCollectionName);
if ( ! db._collection(aCollectionName)) db._createDocumentCollection(aCollectionName);

db[oCollectionName].ensureSkiplist('class');
db[oCollectionName].ensureUniqueSkiplist('id');
db[oCollectionName].ensureFulltextIndex('description');

db[odCollectionName].ensureSkiplist('creation_time');
db[odCollectionName].ensureSkiplist('from_path');
db[odCollectionName].ensureSkiplist('to_path');

db[aCollectionName].ensureUniqueSkiplist('name');
db[aCollectionName].ensureUniqueSkiplist('from_class', 'to_class', 'from_path', 'to_path');

// END
