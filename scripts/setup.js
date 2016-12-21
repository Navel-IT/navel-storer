/*
    Copyright (C) 2015-2016 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const db = require('@arangodb').db;
const graphModule = require('@arangodb/general-graph');

const graphs = [
    'main'
];
const documentCollections = [
    'relations'
];

for (graphName of graphs) {
    if ( ! graphModule._exists(graphName)) graphModule._create(graphName);
}

for (collectionName of documentCollections) {
    if ( ! db._collection(collectionName)) db._createDocumentCollection(collectionName);
}

// END
