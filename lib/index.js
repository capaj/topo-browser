// Load modules

var Hoek = require('hoek');


// Declare internals

var internals = {};


exports = module.exports = internals.Topo = function () {

    this._items = [];
    this.nodes = [];
};


internals.Topo.prototype.add = function (nodes, options) {

    var self = this;

    options = options || {};

    // Validate rules

    var before = [].concat(options.before || []);
    var after = [].concat(options.after || []);
    var group = options.group || '?';

    Hoek.assert(before.indexOf(group) === -1, 'Item cannot come before itself:', group);
    Hoek.assert(before.indexOf('?') === -1, 'Item cannot come before unassociated items');
    Hoek.assert(after.indexOf(group) === -1, 'Item cannot come after itself:', group);
    Hoek.assert(after.indexOf('?') === -1, 'Item cannot come after unassociated items');

    ([].concat(nodes)).forEach(function (node, i) {

        var item = {
            seq: self._items.length,
            before: before,
            after: after,
            group: group,
            node: node
        };

        self._items.push(item);
    });

    // Insert event

    var error = this._sort();
    Hoek.assert(!error, 'item', (group !== '?' ? 'added into group ' + group : ''), 'created a dependencies error');

    return this.nodes;
};


internals.Topo.prototype._sort = function () {

    // Construct graph

    var groups = {};
    var graph = {};
    var graphAfters = {};

    for (var i = 0, il = this._items.length; i < il; ++i) {
        var item = this._items[i];
        var seq = item.seq;                         // Unique across all items
        var group = item.group;

        // Determine Groups

        groups[group] = groups[group] || [];
        groups[group].push(seq);

        // Build intermediary graph using 'before'

        graph[seq] = [item.before];

        // Build second intermediary graph with 'after'

        var after = item.after;
        for (var j = 0, jl = after.length; j < jl; ++j) {
            graphAfters[after[j]] = (graphAfters[after[j]] || []).concat(seq);
        }
    }

    // Expand intermediary graph

    var graphNodes = Object.keys(graph);
    for (i = 0, il = graphNodes.length; i < il; ++i) {
        var node = graphNodes[i];
        var expandedGroups = [];

        var graphNodeItems = Object.keys(graph[node]);
        for (j = 0, jl = graphNodeItems.length; j < jl; ++j) {
            var group = graph[node][graphNodeItems[j]];
            groups[group] = groups[group] || [];
            groups[group].forEach(function (d) {

                expandedGroups.push(d);
            });
        }
        graph[node] = expandedGroups;
    }

    // Merge intermediary graph using graphAfters into final graph

    var afterNodes = Object.keys(graphAfters);
    for (i = 0, il = afterNodes.length; i < il; ++i) {
        var group = afterNodes[i];

        if (groups[group]) {
            for (j = 0, jl = groups[group].length; j < jl; ++j) {
                var node = groups[group][j];
                graph[node] = graph[node].concat(graphAfters[group]);
            }
        }
    }

    // Compile ancestors

    var ancestors = {};
    graphNodes = Object.keys(graph);
    for (i = 0, il = graphNodes.length; i < il; ++i) {
        var node = graphNodes[i];
        var children = graph[node];

        for (j = 0, jl = children.length; j < jl; ++j) {
            ancestors[children[j]] = (ancestors[children[j]] || []).concat(node);
        }
    }

    // Topo sort

    var visited = {};
    var sorted = [];

    for (i = 0, il = this._items.length; i < il; ++i) {
        var next = i;

        if (ancestors[i]) {
            next = null;
            for (j = 0, jl = this._items.length; j < jl; ++j) {
                if (visited[j] === true) {
                    continue;
                }

                if (!ancestors[j]) {
                    ancestors[j] = [];
                }

                var shouldSeeCount = ancestors[j].length;
                var seenCount = 0;
                for (var l = 0, ll = shouldSeeCount; l < ll; ++l) {
                    if (sorted.indexOf(ancestors[j][l]) >= 0) {
                        ++seenCount;
                    }
                }

                if (seenCount === shouldSeeCount) {
                    next = j;
                    break;
                }
            }
        }

        if (next !== null) {
            next = next.toString();         // Normalize to string TODO: replace with seq
            visited[next] = true;
            sorted.push(next);
        }
    }

    if (sorted.length !== this._items.length) {
        return new Error('Invalid dependencies');
    }

    var seqIndex = {};
    this._items.forEach(function (item) {

        seqIndex[item.seq] = item;
    });

    var sortedNodes = [];
    this._items = sorted.map(function (value) {

        var item = seqIndex[value];
        sortedNodes.push(item.node);
        return item;
    });

    this.nodes = sortedNodes;
};
