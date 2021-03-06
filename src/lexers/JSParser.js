define(function (require, exports, module) {
    "use strict";

    var esprima = require("thirdparty/esprima");

    /** @const {string} Placeholder for unnamed functions. */
    var UNNAMED_PLACEHOLDER = "function";

    /**
     * Parse an array of Identifier nodes and the corresponding default values.
     * @private
     * @param   {Indetifier[]} args     List of params
     * @param   {Literal[]}    defaults List of default values
     * @returns {string[]}     List of parsed strings for the arguments.
     */
    function _parseArgs(args, defaults) {
        return args.map(function (arg, i) {
            return arg.name + (defaults[i] ? "=" + defaults[i].value : "");
        });
    }

    /**
     * Visit a node in the ast.
     * If it is a node representing a function, return an object.
     * If it is a node which can be the name of a following function, return a string.
     * @private
     * @param   {object}         node  AST node
     * @param   {string}         name  Name of a previous node
     * @param   {number}         level Indentation level of the function
     * @returns {object|boolean} Parsed function object, or name
     */
    function _visit(node, name, level) {
        if (node.params) {
            name = node.id ? node.id.name : name || UNNAMED_PLACEHOLDER;
            var type;
            if (node.generator) {
                type = "generator";
            } else if (name === UNNAMED_PLACEHOLDER) {
                type = "unnamed";
            } else if (name[0] === "_") {
                type = "private";
            } else if (name[0] === name[0].toUpperCase()) {
                type = "class";
            } else {
                type = "public";
            }
            return {
                name: name,
                line: node.loc.start.line,
                type: type,
                level: level,
                args: _parseArgs(node.params, node.defaults)
            };
        }
        switch (node.type) {
            case "VariableDeclarator":
                return node.id.name;
            case "ExpressionStatement":
                if (node.expression.left) {
                    return node.expression.left.name || node.expression.left.property.name;
                }
                return false;
            case "Property":
                return node.key.name;
            default:
                return false;
        }
    }

    /**
     * Traverse a subtree recursivly.
     * @private
     * @param   {object}   node  AST node
     * @param   {object[]} list  List of objects for the parsed nodes
     * @param   {string}   name  Name of a previous node
     * @param   {number}   level Indentation level of the function
     * @returns {object[]} List of objects for the parsed nodes
     */
    function _traverse(node, list, name, level) {
        if (node && typeof node.type === "string") {
            var res = _visit(node, name, level);
            if (typeof res === "string") {
                name = res;
            } else if (typeof res === "object") {
                list.push(res);
                level++;
            }

            for (var prop in node) {
                // Skip if property name starts with "$"
                if (prop[0] === "$") {
                    continue;
                }

                var child = node[prop];

                if (Array.isArray(child)) {
                    for (var i = 0; i < child.length; i++) {
                        list = _traverse(child[i], list, name, level);
                    }
                } else {
                    list = _traverse(child, list, name, level);
                }
            }
        }
        return list;
    }

    /**
     * Parse the source and extract the code structure.
     * @param   {string}   source the source code.
     * @returns {object[]} the code structure.
     */
    function parse(source) {
        var ast = esprima.parse(source, {
            loc: true,
            tolerant: true
        });

        var result = _traverse(ast, [], "", 0);
        return result;
    }

    module.exports = {
        parse: parse
    };
});
