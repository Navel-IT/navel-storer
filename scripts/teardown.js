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
