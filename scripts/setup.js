/*
    Copyright (C) 2015-2017 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const db = require('@arangodb').db,
    eventsCollectionName = 'events',
    relationsCollectionName = 'relations',
    aggregatorsCollectionName = 'aggregators';

if ( ! db._collection(eventsCollectionName)) db._createDocumentCollection(eventsCollectionName);
if ( ! db._collection(relationsCollectionName)) db._createEdgeCollection(relationsCollectionName);
if ( ! db._collection(aggregatorsCollectionName)) db._createDocumentCollection(aggregatorsCollectionName);

db[eventsCollectionName].ensureSkiplist('time');
db[eventsCollectionName].ensureSkiplist('class');
db[eventsCollectionName].ensureSkiplist('id');
db[eventsCollectionName].ensureFulltextIndex('description');

db[relationsCollectionName].ensureSkiplist('from_path');
db[relationsCollectionName].ensureSkiplist('to_path');

db[aggregatorsCollectionName].ensureUniqueSkiplist('name');
db[aggregatorsCollectionName].ensureSkiplist('from_class');
db[aggregatorsCollectionName].ensureSkiplist('to_class');
db[aggregatorsCollectionName].ensureSkiplist('from_path');
db[aggregatorsCollectionName].ensureSkiplist('to_path');

// END
