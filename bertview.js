var wr = chrome.declarativeWebRequest;
wr.onRequest.addRules([{
    conditions: [new wr.RequestMatcher({resourceType: ['main_frame'],contentType: ["application/x-erlang-binary64"]})],
    actions:    [new wr.RemoveResponseHeader({name:"content-type"}),
                 new wr.AddResponseHeader({name:"content-type",value:"text/plain"}),
                 new wr.AddResponseCookie({cookie: {name:"customview",value:"bert64"}})]
},{
    conditions: [new wr.RequestMatcher({resourceType: ['main_frame'],contentType: ["application/x-erlang-binary"]})],
    actions:    [new wr.RemoveResponseHeader({name:"content-type"}),
                 new wr.AddResponseHeader({name:"content-type",value:"image/png"}),
                 new wr.AddResponseCookie({cookie: {name:"customview",value:"bert"}})]
},{
    conditions: [new wr.RequestMatcher({resourceType: ['main_frame'],excludeContentType: ["application/x-erlang-binary","application/x-erlang-binary64"]})],
    actions:    [new wr.RemoveResponseCookie({filter: {name:"customview"}})]
}]);
chrome.runtime.onMessage.addListener(function(msg,sender) {
    if(msg.bertdata) chrome.tabs.sendMessage(sender.tab.id,{bertToHtml: convertBert(msg.bertdata)});
});

function convertBert(data){
  function JSONFormatter() {}
  JSONFormatter.prototype = {
    htmlEncode: function (t) {
      return t != null ? t.toString().replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;") : '';
    },

    decorateWithSpan: function (value, className) {
      return '<span class="' + className + '">' + this.htmlEncode(value) + '</span>';
    },

    // Convert a basic JSON datatype (number, string, boolean, null, object, array) into an HTML fragment.
    valueToHTML: function(value) {
      var valueType = typeof value;

      var output = "";
      if (value == null) {
        output += this.decorateWithSpan('null', 'null');
      }
      else if (value && value.constructor == Array) {
        output += this.arrayToHTML(value);
      }
      else if (valueType == 'object') {
        output += this.objectToHTML(value);
      } 
      else if (valueType == 'number') {
        output += this.decorateWithSpan(value, 'num');
      }
      else if (valueType == 'string') {
        if (/^(http|https):\/\/[^\s]+$/.test(value)) {
          output += '<a href="' + value + '">' + this.htmlEncode(value) + '</a>';
        } else {
          output += this.decorateWithSpan('"' + value + '"', 'string');
        }
      }
      else if (valueType == 'boolean') {
        output += this.decorateWithSpan(value, 'bool');
      }

      return output;
    },

    // Convert an array into an HTML fragment
    arrayToHTML: function(json) {
      var output = '[<ul class="array collapsible">';
      var hasContents = false;
      for ( var prop in json ) {
        hasContents = true;
        output += '<li>';
        output += this.valueToHTML(json[prop]);
        output += '</li>';
      }
      output += '</ul>]';

      if ( ! hasContents ) {
        output = "[ ]";
      }

      return output;
    },

    // Convert a JSON object to an HTML fragment
    objectToHTML: function(json) {
      var output = '{<ul class="obj collapsible">';
      var hasContents = false;
      for ( var prop in json ) {
        hasContents = true;
        output += '<li>';
        output += '<span class="prop">' + this.htmlEncode(prop) + '</span>: ';
        output += this.valueToHTML(json[prop]);
        output += '</li>';
      }
      output += '</ul>}';

      if ( ! hasContents ) {
        output = "{ }";
      }

      return output;
    },

    // Convert a whole JSON object into a formatted HTML document.
    jsonToHTML: function(json, callback, uri) {
      var output = '';
      if( callback ){
        output += '<div class="callback">' + callback + ' (</div>';
        output += '<div id="json">';
      }else{
        output += '<div id="json">';
      }
      output += this.valueToHTML(json);
      output += '</div>';
      if( callback ){
        output += '<div class="callback">)</div>';
      }
      return this.toHTML(output, uri);
    },

    // Produce an error document for when parsing fails.
    errorPage: function(error, data, uri) {
      // var output = '<div id="error">' + this.stringbundle.GetStringFromName('errorParsing') + '</div>';
      // output += '<h1>' + this.stringbundle.GetStringFromName('docContents') + ':</h1>';
      var output = '<div id="error">Error parsing JSON: '+error.message+'</div>';
      output += '<h1>'+error.stack+':</h1>';      
      output += '<div id="json">' + this.htmlEncode(data) + '</div>';
      return this.toHTML(output, uri + ' - Error');
    },

    // Wrap the HTML fragment in a full document. Used by jsonToHTML and errorPage.
    toHTML: function(content, title) {
      return '<head><title>' + title + '</title>' +
        '<link rel="stylesheet" type="text/css" href="'+chrome.extension.getURL("default.css")+'">' + 
        '</head><body>' +
        content + 
        '</body>';
    }
  };

  // Sanitize & output -- all magic from JSONView Firefox
  this.jsonFormatter = new JSONFormatter();
  var outputDoc = '';
  // Covert, and catch exceptions on failure
  try {
    var jsonObj = Bert.easy_decode(data);
    if ( jsonObj ) {        
      outputDoc = this.jsonFormatter.jsonToHTML(jsonObj, '', this.uri);
    } else {
      throw "There was no object!";
    }
  } catch(e) {
    console.log(e);
    outputDoc = this.jsonFormatter.errorPage(e, data, this.uri);
  }
  return outputDoc;
}
