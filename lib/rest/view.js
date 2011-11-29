var http = require('http'), mime = require('mime'), url = require('url');

function NotAcceptable(message) {  
    this.name = "NotAcceptable";  
    this.message = message;
    this.code = 406;  
}
NotAcceptable.prototype = new Error();  
NotAcceptable.prototype.constructor = NotAcceptable;  

/**
 * Create a token from the accept header part of an HTTP request.
 */
var tokenize = exports.tokenize = function(token) {
	parts = token.match(/([\w|\*]+)\/([\w\*]+)(?:;?)(.*)/), //
	token = {
		params : {
			q : '1'
		},
		type : parts[1],
		subtype : parts[2],
		precedence : (parts[1] != '*') + (parts[2] != '*')
	};
	// Parse extensions
	if(parts[3] && parts[3] !== '') {
		parts[3].split(';').forEach(function(param, i) {
			var ext = param.split('='), key = ext[0].replace(/^\s+|\s+$/g, "");
			token.params[key] = ext[1];
			token.precedence += (key != 'q');
		});
	}
	return token;
};

/**
 * Content negotiate a given Accept header and return a token that represents the best match
 * from the list of given types.
 */
var negotiate = exports.negotiate = function(header, types) {
	var bestMatch = null, paramRegex = '(?:;?)[^,]*';
	types.forEach(function(type, i) {
		var checkFor = [type, type.split('/')[0] + '\/\\*', '\\*\/\\*'];
		for(var i = 0; i < checkFor.length; i++) {
			var matches = header.match(checkFor[i] + paramRegex);
			if(matches !== null) {
				var token = tokenize(matches[0]);
				// This token will be picked as the best match if
				if(bestMatch == null || // We don't have one
					bestMatch.params.q < token.params.q || // It has a higher quality requested
					(bestMatch.params.q == token.params.q && bestMatch.precedence < token.precedence))
					// It has the same quality but is more speficic (higher precedence)
				{
					token.renders = type;
					bestMatch = token;
				}
			}
		}
	});
	return bestMatch;
}

exports.middleware = function(options) {
	var types = [];
	for(var type in exports.render) {
		types.push(type);
	}
	return function(req, res, next)
	{
		var path = url.parse(req.url).pathname, //
			index = path.lastIndexOf('.'), //
			ext = !!~index ? path.substr(index) : false,
			type = null;
		if(ext) {
			type = mime.lookup(ext, null);
		} else {
			header = req.headers['Accept'] || '*/*',
			type = negotiate(header, types).renders;
		}
		if(exports.render[type]) {
			res.setHeader('Content-Type', type);
			exports.render[type](req, res);
		} else {
			next('Could not render any of ' + type);
		}
	};
}

exports.render = {};

exports.render['text/html'] = function(req, res) {
	res.end('Rendering some HTML');
}

exports.render['application/json'] = function(req, res) {
	res.end(JSON.stringify(res.data));
};
