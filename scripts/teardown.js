/*
    Copyright (C) 2015-2017 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

for (const collection of [
    module.context.collection('o'),
    module.context.collection('d'),
    module.context.collection('oo'),
    module.context.collection('od'),
    module.context.collection('a')
]) {
    if (collection) collection.drop();
}

// END
