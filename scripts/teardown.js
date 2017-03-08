/*
    Copyright (C) 2015-2017 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const db = require('@arangodb').db,
    eventsCollection = module.context.collection('events'),
    relationsCollection = module.context.collection('relations'),
    aggregatorsCollection = module.context.collection('aggregators');

if (eventsCollection) eventsCollection.drop();
if (relationsCollection) relationsCollection.drop();
if (aggregatorsCollection) aggregatorsCollection.drop();

// END
