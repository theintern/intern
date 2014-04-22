define([], function () {
	/**
	 * Simple XML generator.
	 * @constructor
	 * @param nodeName The node name.
	 * @param attributes Optional attributes.
	 */
	function XmlNode(/**string*/ nodeName, /**Object?*/ attributes) {
		this.nodeName = nodeName;
		this.childNodes = [];
		this.attributes = attributes || {};
	}

	XmlNode.prototype = {
		constructor: XmlNode,
		nodeName: '',
		childNodes: [],
		attributes: {},

		/**
		 * Creates a new XML node and pushes it to the end of the current node.
		 * @param nodeName The node name for the new node.
		 * @param attributes Optional attributes for the new node.
		 * @returns {XmlNode} A new node.
		 */
		createNode: function (/**string*/ nodeName, /**Object?*/ attributes) {
			var node = new XmlNode(nodeName, attributes);
			if (this._hasContent) {
				this.childNodes = [];
				this._hasContent = false;
			}
			this.childNodes.push(node);
			return node;
		},

		setContent: function(/**string*/ content) {
			this.childNodes = [content];
			this._hasContent = true;
		},

		_escape: function (str) {
			return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
		},

		_printAttributes: function (attrs) {
			var nodes = [];

			for (var key in attrs) {
				if (attrs.hasOwnProperty(key) && attrs[key] != null) {
					nodes.push(key + '="' + this._escape(attrs[key]) + '"');
				}
			}

			return nodes.length ? ' ' + nodes.join(' ') : '';
		},

		_printChildren: function (nodeList) {
			var nodes = [];
			for (var i = 0, j = nodeList.length; i < j; ++i) {
				nodes.push(typeof nodeList[i] === 'string' ? this._escape(nodeList[i]) : nodeList[i].toString());
			}

			return nodes.join('');
		},

		/**
		 * Outputs the node as a serialised XML string.
		 * @returns {string}
		 */
		toString: function () {
			var children = this._printChildren(this.childNodes);

			return '<' + this.nodeName + this._printAttributes(this.attributes) + (children.length ? '>' + children +
				'</' + this.nodeName + '>' : '/>');
		}
	};

	return XmlNode;
});
