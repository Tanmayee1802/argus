var e = require("graphql");

var t = require("crypto");

exports.ts = void 0;

class CharacterStream {
  constructor(e) {
    this._start = 0;
    this._pos = 0;
    this.getStartOfToken = () => this._start;
    this.getCurrentPosition = () => this._pos;
    this.eol = () => this._sourceText.length === this._pos;
    this.sol = () => 0 === this._pos;
    this.peek = () => this._sourceText.charAt(this._pos) || null;
    this.next = () => {
      var e = this._sourceText.charAt(this._pos);
      this._pos++;
      return e;
    };
    this.eat = e => {
      if (this._testNextCharacter(e)) {
        this._start = this._pos;
        this._pos++;
        return this._sourceText.charAt(this._pos - 1);
      }
      return;
    };
    this.eatWhile = e => {
      var t = this._testNextCharacter(e);
      var i = !1;
      if (t) {
        i = t;
        this._start = this._pos;
      }
      while (t) {
        this._pos++;
        t = this._testNextCharacter(e);
        i = !0;
      }
      return i;
    };
    this.eatSpace = () => this.eatWhile(/[\s\u00a0]/);
    this.skipToEnd = () => {
      this._pos = this._sourceText.length;
    };
    this.skipTo = e => {
      this._pos = e;
    };
    this.match = (e, t = !0, i = !1) => {
      var r = null;
      var s = null;
      if ("string" == typeof e) {
        s = new RegExp(e, i ? "i" : "g").test(this._sourceText.slice(this._pos, this._pos + e.length));
        r = e;
      } else if (e instanceof RegExp) {
        r = null == (s = this._sourceText.slice(this._pos).match(e)) ? void 0 : s[0];
      }
      if (null != s && ("string" == typeof e || s instanceof Array && this._sourceText.startsWith(s[0], this._pos))) {
        if (t) {
          this._start = this._pos;
          if (r && r.length) {
            this._pos += r.length;
          }
        }
        return s;
      }
      return !1;
    };
    this.backUp = e => {
      this._pos -= e;
    };
    this.column = () => this._pos;
    this.indentation = () => {
      var e = this._sourceText.match(/\s*/);
      var t = 0;
      if (e && 0 !== e.length) {
        var i = e[0];
        var r = 0;
        while (i.length > r) {
          if (9 === i.charCodeAt(r)) {
            t += 2;
          } else {
            t++;
          }
          r++;
        }
      }
      return t;
    };
    this.current = () => this._sourceText.slice(this._start, this._pos);
    this._sourceText = e;
  }
  _testNextCharacter(e) {
    var t = this._sourceText.charAt(this._pos);
    var i = !1;
    if ("string" == typeof e) {
      i = t === e;
    } else {
      i = e instanceof RegExp ? e.test(t) : e(t);
    }
    return i;
  }
}

function opt(e) {
  return {
    ofRule: e
  };
}

function list(e, t) {
  return {
    ofRule: e,
    isList: !0,
    separator: t
  };
}

function t$1(e, t) {
  return {
    style: t,
    match: t => t.kind === e
  };
}

function p(e, t) {
  return {
    style: t || "punctuation",
    match: t => "Punctuation" === t.kind && t.value === e
  };
}

var isIgnored = e => " " === e || "\t" === e || "," === e || "\n" === e || "\r" === e || "\ufeff" === e || " " === e;

var i = {
  Name: /^[_A-Za-z][_0-9A-Za-z]*/,
  Punctuation: /^(?:!|\$|\(|\)|\.\.\.|:|=|&|@|\[|]|\{|\||\})/,
  Number: /^-?(?:0|(?:[1-9][0-9]*))(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?/,
  String: /^(?:"""(?:\\"""|[^"]|"[^"]|""[^"])*(?:""")?|"(?:[^"\\]|\\(?:"|\/|\\|b|f|n|r|t|u[0-9a-fA-F]{4}))*"?)/,
  Comment: /^#.*/
};

var r = {
  Document: [ list("Definition") ],
  Definition(t) {
    switch (t.value) {
     case "{":
      return "ShortQuery";

     case "query":
      return "Query";

     case "mutation":
      return "Mutation";

     case "subscription":
      return "Subscription";

     case "fragment":
      return e.Kind.FRAGMENT_DEFINITION;

     case "schema":
      return "SchemaDef";

     case "scalar":
      return "ScalarDef";

     case "type":
      return "ObjectTypeDef";

     case "interface":
      return "InterfaceDef";

     case "union":
      return "UnionDef";

     case "enum":
      return "EnumDef";

     case "input":
      return "InputDef";

     case "extend":
      return "ExtendDef";

     case "directive":
      return "DirectiveDef";
    }
  },
  ShortQuery: [ "SelectionSet" ],
  Query: [ word("query"), opt(name$1("def")), opt("VariableDefinitions"), list("Directive"), "SelectionSet" ],
  Mutation: [ word("mutation"), opt(name$1("def")), opt("VariableDefinitions"), list("Directive"), "SelectionSet" ],
  Subscription: [ word("subscription"), opt(name$1("def")), opt("VariableDefinitions"), list("Directive"), "SelectionSet" ],
  VariableDefinitions: [ p("("), list("VariableDefinition"), p(")") ],
  VariableDefinition: [ "Variable", p(":"), "Type", opt("DefaultValue") ],
  Variable: [ p("$", "variable"), name$1("variable") ],
  DefaultValue: [ p("="), "Value" ],
  SelectionSet: [ p("{"), list("Selection"), p("}") ],
  Selection: (e, t) => "..." === e.value ? t.match(/[\s\u00a0,]*(on\b|@|{)/, !1) ? "InlineFragment" : "FragmentSpread" : t.match(/[\s\u00a0,]*:/, !1) ? "AliasedField" : "Field",
  AliasedField: [ name$1("property"), p(":"), name$1("qualifier"), opt("Arguments"), list("Directive"), opt("SelectionSet") ],
  Field: [ name$1("property"), opt("Arguments"), list("Directive"), opt("SelectionSet") ],
  Arguments: [ p("("), list("Argument"), p(")") ],
  Argument: [ name$1("attribute"), p(":"), "Value" ],
  FragmentSpread: [ p("..."), name$1("def"), list("Directive") ],
  InlineFragment: [ p("..."), opt("TypeCondition"), list("Directive"), "SelectionSet" ],
  FragmentDefinition: [ word("fragment"), opt(function butNot(e, t) {
    var i = e.match;
    e.match = e => {
      var r = !1;
      if (i) {
        r = i(e);
      }
      return r && t.every(t => t.match && !t.match(e));
    };
    return e;
  }(name$1("def"), [ word("on") ])), "TypeCondition", list("Directive"), "SelectionSet" ],
  TypeCondition: [ word("on"), "NamedType" ],
  Value(e) {
    switch (e.kind) {
     case "Number":
      return "NumberValue";

     case "String":
      return "StringValue";

     case "Punctuation":
      switch (e.value) {
       case "[":
        return "ListValue";

       case "{":
        return "ObjectValue";

       case "$":
        return "Variable";

       case "&":
        return "NamedType";
      }
      return null;

     case "Name":
      switch (e.value) {
       case "true":
       case "false":
        return "BooleanValue";
      }
      if ("null" === e.value) {
        return "NullValue";
      }
      return "EnumValue";
    }
  },
  NumberValue: [ t$1("Number", "number") ],
  StringValue: [ {
    style: "string",
    match: e => "String" === e.kind,
    update(e, t) {
      if (t.value.startsWith('"""')) {
        e.inBlockstring = !t.value.slice(3).endsWith('"""');
      }
    }
  } ],
  BooleanValue: [ t$1("Name", "builtin") ],
  NullValue: [ t$1("Name", "keyword") ],
  EnumValue: [ name$1("string-2") ],
  ListValue: [ p("["), list("Value"), p("]") ],
  ObjectValue: [ p("{"), list("ObjectField"), p("}") ],
  ObjectField: [ name$1("attribute"), p(":"), "Value" ],
  Type: e => "[" === e.value ? "ListType" : "NonNullType",
  ListType: [ p("["), "Type", p("]"), opt(p("!")) ],
  NonNullType: [ "NamedType", opt(p("!")) ],
  NamedType: [ function type$1(e) {
    return {
      style: e,
      match: e => "Name" === e.kind,
      update(e, t) {
        var i;
        if (null === (i = e.prevState) || void 0 === i ? void 0 : i.prevState) {
          e.name = t.value;
          e.prevState.prevState.type = t.value;
        }
      }
    };
  }("atom") ],
  Directive: [ p("@", "meta"), name$1("meta"), opt("Arguments") ],
  DirectiveDef: [ word("directive"), p("@", "meta"), name$1("meta"), opt("ArgumentsDef"), word("on"), list("DirectiveLocation", p("|")) ],
  InterfaceDef: [ word("interface"), name$1("atom"), opt("Implements"), list("Directive"), p("{"), list("FieldDef"), p("}") ],
  Implements: [ word("implements"), list("NamedType", p("&")) ],
  DirectiveLocation: [ name$1("string-2") ],
  SchemaDef: [ word("schema"), list("Directive"), p("{"), list("OperationTypeDef"), p("}") ],
  OperationTypeDef: [ name$1("keyword"), p(":"), name$1("atom") ],
  ScalarDef: [ word("scalar"), name$1("atom"), list("Directive") ],
  ObjectTypeDef: [ word("type"), name$1("atom"), opt("Implements"), list("Directive"), p("{"), list("FieldDef"), p("}") ],
  FieldDef: [ name$1("property"), opt("ArgumentsDef"), p(":"), "Type", list("Directive") ],
  ArgumentsDef: [ p("("), list("InputValueDef"), p(")") ],
  InputValueDef: [ name$1("attribute"), p(":"), "Type", opt("DefaultValue"), list("Directive") ],
  UnionDef: [ word("union"), name$1("atom"), list("Directive"), p("="), list("UnionMember", p("|")) ],
  UnionMember: [ "NamedType" ],
  EnumDef: [ word("enum"), name$1("atom"), list("Directive"), p("{"), list("EnumValueDef"), p("}") ],
  EnumValueDef: [ name$1("string-2"), list("Directive") ],
  InputDef: [ word("input"), name$1("atom"), list("Directive"), p("{"), list("InputValueDef"), p("}") ],
  ExtendDef: [ word("extend"), "ExtensionDefinition" ],
  ExtensionDefinition(t) {
    switch (t.value) {
     case "schema":
      return e.Kind.SCHEMA_EXTENSION;

     case "scalar":
      return e.Kind.SCALAR_TYPE_EXTENSION;

     case "type":
      return e.Kind.OBJECT_TYPE_EXTENSION;

     case "interface":
      return e.Kind.INTERFACE_TYPE_EXTENSION;

     case "union":
      return e.Kind.UNION_TYPE_EXTENSION;

     case "enum":
      return e.Kind.ENUM_TYPE_EXTENSION;

     case "input":
      return e.Kind.INPUT_OBJECT_TYPE_EXTENSION;
    }
  },
  [e.Kind.SCHEMA_EXTENSION]: [ "SchemaDef" ],
  [e.Kind.SCALAR_TYPE_EXTENSION]: [ "ScalarDef" ],
  [e.Kind.OBJECT_TYPE_EXTENSION]: [ "ObjectTypeDef" ],
  [e.Kind.INTERFACE_TYPE_EXTENSION]: [ "InterfaceDef" ],
  [e.Kind.UNION_TYPE_EXTENSION]: [ "UnionDef" ],
  [e.Kind.ENUM_TYPE_EXTENSION]: [ "EnumDef" ],
  [e.Kind.INPUT_OBJECT_TYPE_EXTENSION]: [ "InputDef" ]
};

function word(e) {
  return {
    style: "keyword",
    match: t => "Name" === t.kind && t.value === e
  };
}

function name$1(e) {
  return {
    style: e,
    match: e => "Name" === e.kind,
    update(e, t) {
      e.name = t.value;
    }
  };
}

function onlineParser(t = {
  eatWhitespace: e => e.eatWhile(isIgnored),
  lexRules: i,
  parseRules: r,
  editorConfig: {}
}) {
  return {
    startState() {
      var i = {
        level: 0,
        step: 0,
        name: null,
        kind: null,
        type: null,
        rule: null,
        needsSeparator: !1,
        prevState: null
      };
      pushRule(t.parseRules, i, e.Kind.DOCUMENT);
      return i;
    },
    token: (e, i) => function getToken(e, t, i) {
      var r;
      if (t.inBlockstring) {
        if (e.match(/.*"""/)) {
          t.inBlockstring = !1;
          return "string";
        }
        e.skipToEnd();
        return "string";
      }
      var {lexRules: a, parseRules: n, eatWhitespace: o, editorConfig: l} = i;
      if (t.rule && 0 === t.rule.length) {
        popRule(t);
      } else if (t.needsAdvance) {
        t.needsAdvance = !1;
        advanceRule(t, !0);
      }
      if (e.sol()) {
        var u = (null == l ? void 0 : l.tabSize) || 2;
        t.indentLevel = Math.floor(e.indentation() / u);
      }
      if (o(e)) {
        return "ws";
      }
      var c = function lex(e, t) {
        var i = Object.keys(e);
        for (var r = 0; r < i.length; r++) {
          var s = t.match(e[i[r]]);
          if (s && s instanceof Array) {
            return {
              kind: i[r],
              value: s[0]
            };
          }
        }
      }(a, e);
      if (!c) {
        if (!e.match(/\S+/)) {
          e.match(/\s/);
        }
        pushRule(s, t, "Invalid");
        return "invalidchar";
      }
      if ("Comment" === c.kind) {
        pushRule(s, t, "Comment");
        return "comment";
      }
      var f = assign({}, t);
      if ("Punctuation" === c.kind) {
        if (/^[{([]/.test(c.value)) {
          if (void 0 !== t.indentLevel) {
            t.levels = (t.levels || []).concat(t.indentLevel + 1);
          }
        } else if (/^[})\]]/.test(c.value)) {
          var h = t.levels = (t.levels || []).slice(0, -1);
          if (t.indentLevel && h.length > 0 && h.at(-1) < t.indentLevel) {
            t.indentLevel = h.at(-1);
          }
        }
      }
      while (t.rule) {
        var d = "function" == typeof t.rule ? 0 === t.step ? t.rule(c, e) : null : t.rule[t.step];
        if (t.needsSeparator) {
          d = null == d ? void 0 : d.separator;
        }
        if (d) {
          if (d.ofRule) {
            d = d.ofRule;
          }
          if ("string" == typeof d) {
            pushRule(n, t, d);
            continue;
          }
          if (null === (r = d.match) || void 0 === r ? void 0 : r.call(d, c)) {
            if (d.update) {
              d.update(t, c);
            }
            if ("Punctuation" === c.kind) {
              advanceRule(t, !0);
            } else {
              t.needsAdvance = !0;
            }
            return d.style;
          }
        }
        unsuccessful(t);
      }
      assign(t, f);
      pushRule(s, t, "Invalid");
      return "invalidchar";
    }(e, i, t)
  };
}

function assign(e, t) {
  var i = Object.keys(t);
  for (var r = 0; r < i.length; r++) {
    e[i[r]] = t[i[r]];
  }
  return e;
}

var s = {
  Invalid: [],
  Comment: []
};

function pushRule(e, t, i) {
  if (!e[i]) {
    throw new TypeError("Unknown rule: " + i);
  }
  t.prevState = Object.assign({}, t);
  t.kind = i;
  t.name = null;
  t.type = null;
  t.rule = e[i];
  t.step = 0;
  t.needsSeparator = !1;
}

function popRule(e) {
  if (!e.prevState) {
    return;
  }
  e.kind = e.prevState.kind;
  e.name = e.prevState.name;
  e.type = e.prevState.type;
  e.rule = e.prevState.rule;
  e.step = e.prevState.step;
  e.needsSeparator = e.prevState.needsSeparator;
  e.prevState = e.prevState.prevState;
}

function advanceRule(e, t) {
  var i;
  if (isList(e) && e.rule) {
    var r = e.rule[e.step];
    if (r.separator) {
      var {separator: s} = r;
      e.needsSeparator = !e.needsSeparator;
      if (!e.needsSeparator && s.ofRule) {
        return;
      }
    }
    if (t) {
      return;
    }
  }
  e.needsSeparator = !1;
  e.step++;
  while (e.rule && !(Array.isArray(e.rule) && e.step < e.rule.length)) {
    popRule(e);
    if (e.rule) {
      if (isList(e)) {
        if (null === (i = e.rule) || void 0 === i ? void 0 : i[e.step].separator) {
          e.needsSeparator = !e.needsSeparator;
        }
      } else {
        e.needsSeparator = !1;
        e.step++;
      }
    }
  }
}

function isList(e) {
  var t = Array.isArray(e.rule) && "string" != typeof e.rule[e.step] && e.rule[e.step];
  return t && t.isList;
}

function unsuccessful(e) {
  while (e.rule && (!Array.isArray(e.rule) || !e.rule[e.step].ofRule)) {
    popRule(e);
  }
  if (e.rule) {
    advanceRule(e, !1);
  }
}

function getDefaultExportFromCjs(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}

class Range {
  constructor(e, t) {
    this.containsPosition = e => {
      if (this.start.line === e.line) {
        return this.start.character <= e.character;
      }
      if (this.end.line === e.line) {
        return this.end.character >= e.character;
      }
      return this.start.line <= e.line && this.end.line >= e.line;
    };
    this.start = e;
    this.end = t;
  }
  setStart(e, t) {
    this.start = new Position(e, t);
  }
  setEnd(e, t) {
    this.end = new Position(e, t);
  }
}

class Position {
  constructor(e, t) {
    this.lessThanOrEqualTo = e => this.line < e.line || this.line === e.line && this.character <= e.character;
    this.line = e;
    this.character = t;
  }
  setLine(e) {
    this.line = e;
  }
  setCharacter(e) {
    this.character = e;
  }
}

var a = [ e.LoneSchemaDefinitionRule, e.UniqueOperationTypesRule, e.UniqueTypeNamesRule, e.UniqueEnumValueNamesRule, e.UniqueFieldDefinitionNamesRule, e.UniqueDirectiveNamesRule, e.KnownTypeNamesRule, e.KnownDirectivesRule, e.UniqueDirectivesPerLocationRule, e.PossibleTypeExtensionsRule, e.UniqueArgumentNamesRule, e.UniqueInputFieldNamesRule ];

var n = "Error", o = "Warning", l = "Information", u = "Hint";

var c = {
  [n]: 1,
  [o]: 2,
  [l]: 3,
  [u]: 4
};

var invariant = (e, t) => {
  if (!e) {
    throw new Error(t);
  }
};

function getDiagnostics(t, i = null, r, s, n) {
  var o, l;
  var u = null;
  var f = "";
  if (n) {
    f = "string" == typeof n ? n : n.reduce((t, i) => t + e.print(i) + "\n\n", "");
  }
  var h = f ? `${t}\n\n${f}` : t;
  try {
    u = e.parse(h);
  } catch (t) {
    if (t instanceof e.GraphQLError) {
      var d = function getRange(e, t) {
        var i = onlineParser();
        var r = i.startState();
        var s = t.split("\n");
        invariant(s.length >= e.line, "Query text must have more lines than where the error happened");
        var a = null;
        for (var n = 0; n < e.line; n++) {
          a = new CharacterStream(s[n]);
          while (!a.eol()) {
            if ("invalidchar" === i.token(a, r)) {
              break;
            }
          }
        }
        invariant(a, "Expected Parser stream to be available.");
        var o = e.line - 1;
        var l = a.getStartOfToken();
        var u = a.getCurrentPosition();
        return new Range(new Position(o, l), new Position(o, u));
      }(null !== (l = null === (o = t.locations) || void 0 === o ? void 0 : o[0]) && void 0 !== l ? l : {
        line: 0,
        column: 0
      }, h);
      return [ {
        severity: c.Error,
        message: t.message,
        source: "GraphQL: Syntax",
        range: d
      } ];
    }
    throw t;
  }
  return function validateQuery(t, i = null, r, s) {
    if (!i) {
      return [];
    }
    var n = function validateWithCustomRules(t, i, r, s, n) {
      var o = e.specifiedRules.filter(t => {
        if (t === e.NoUnusedFragmentsRule || t === e.ExecutableDefinitionsRule) {
          return !1;
        }
        if (s && t === e.KnownFragmentNamesRule) {
          return !1;
        }
        return !0;
      });
      if (r) {
        Array.prototype.push.apply(o, r);
      }
      if (n) {
        Array.prototype.push.apply(o, a);
      }
      return e.validate(t, i, o).filter(t => {
        if (t.message.includes("Unknown directive") && t.nodes) {
          var i = t.nodes[0];
          if (i && i.kind === e.Kind.DIRECTIVE) {
            var r = i.name.value;
            if ("arguments" === r || "argumentDefinitions" === r) {
              return !1;
            }
          }
        }
        return !0;
      });
    }(i, t, r, s).flatMap(e => annotations(e, c.Error, "Validation"));
    var o = e.validate(i, t, [ e.NoDeprecatedCustomRule ]).flatMap(e => annotations(e, c.Warning, "Deprecation"));
    return n.concat(o);
  }(u, i, r, s);
}

function annotations(e, t, i) {
  if (!e.nodes) {
    return [];
  }
  var r = [];
  for (var [s, a] of e.nodes.entries()) {
    var n = "Variable" !== a.kind && "name" in a && void 0 !== a.name ? a.name : "variable" in a && void 0 !== a.variable ? a.variable : a;
    if (n) {
      invariant(e.locations, "GraphQL validation error requires locations.");
      var o = e.locations[s];
      var l = getLocation(n);
      var u = o.column + (l.end - l.start);
      r.push({
        source: `GraphQL: ${i}`,
        message: e.message,
        severity: t,
        range: new Range(new Position(o.line - 1, o.column - 1), new Position(o.line - 1, u))
      });
    }
  }
  return r;
}

function getLocation(e) {
  var t = e.loc;
  invariant(t, "Expected ASTNode to have a location.");
  return t;
}

var f = "FragmentDefinition";

class GraphQLError extends Error {
  constructor(e, t, i, r, s, a, n) {
    if (super(e), this.name = "GraphQLError", this.message = e, s) {
      this.path = s;
    }
    if (t) {
      this.nodes = Array.isArray(t) ? t : [ t ];
    }
    if (i) {
      this.source = i;
    }
    if (r) {
      this.positions = r;
    }
    if (a) {
      this.originalError = a;
    }
    var o = n;
    if (!o && a) {
      var l = a.extensions;
      if (l && "object" == typeof l) {
        o = l;
      }
    }
    this.extensions = o || {};
  }
  toJSON() {
    return {
      ...this,
      message: this.message
    };
  }
  toString() {
    return this.message;
  }
  get [Symbol.toStringTag]() {
    return "GraphQLError";
  }
}

var h;

var d;

function error(e) {
  return new GraphQLError(`Syntax Error: Unexpected token at ${d} in ${e}`);
}

function advance(e) {
  if (e.lastIndex = d, e.test(h)) {
    return h.slice(d, d = e.lastIndex);
  }
}

var v = / +(?=[^\s])/y;

function blockString(e) {
  var t = e.split("\n");
  var i = "";
  var r = 0;
  var s = 0;
  var a = t.length - 1;
  for (var n = 0; n < t.length; n++) {
    if (v.lastIndex = 0, v.test(t[n])) {
      if (n && (!r || v.lastIndex < r)) {
        r = v.lastIndex;
      }
      s = s || n, a = n;
    }
  }
  for (var o = s; o <= a; o++) {
    if (o !== s) {
      i += "\n";
    }
    i += t[o].slice(r).replace(/\\"""/g, '"""');
  }
  return i;
}

function ignored() {
  for (var e = 0 | h.charCodeAt(d++); 9 === e || 10 === e || 13 === e || 32 === e || 35 === e || 44 === e || 65279 === e; e = 0 | h.charCodeAt(d++)) {
    if (35 === e) {
      for (;(e = 0 | h.charCodeAt(d++)) && 10 !== e && 13 !== e; ) {}
    }
  }
  d--;
}

function name() {
  var e = d;
  for (var t = 0 | h.charCodeAt(d++); t >= 48 && t <= 57 || t >= 65 && t <= 90 || 95 === t || t >= 97 && t <= 122; t = 0 | h.charCodeAt(d++)) {}
  if (e === d - 1) {
    throw error("Name");
  }
  var i = h.slice(e, --d);
  return ignored(), i;
}

function nameNode() {
  return {
    kind: "Name",
    value: name()
  };
}

var g = /(?:"""|(?:[\s\S]*?[^\\])""")/y;

var m = /(?:(?:\.\d+)?[eE][+-]?\d+|\.\d+)/y;

function value(e) {
  var t;
  switch (h.charCodeAt(d)) {
   case 91:
    d++, ignored();
    var i = [];
    for (;93 !== h.charCodeAt(d); ) {
      i.push(value(e));
    }
    return d++, ignored(), {
      kind: "ListValue",
      values: i
    };

   case 123:
    d++, ignored();
    var r = [];
    for (;125 !== h.charCodeAt(d); ) {
      var s = nameNode();
      if (58 !== h.charCodeAt(d++)) {
        throw error("ObjectField");
      }
      ignored(), r.push({
        kind: "ObjectField",
        name: s,
        value: value(e)
      });
    }
    return d++, ignored(), {
      kind: "ObjectValue",
      fields: r
    };

   case 36:
    if (e) {
      throw error("Variable");
    }
    return d++, {
      kind: "Variable",
      name: nameNode()
    };

   case 34:
    if (34 === h.charCodeAt(d + 1) && 34 === h.charCodeAt(d + 2)) {
      if (d += 3, null == (t = advance(g))) {
        throw error("StringValue");
      }
      return ignored(), {
        kind: "StringValue",
        value: blockString(t.slice(0, -3)),
        block: !0
      };
    } else {
      var a = d;
      var n;
      d++;
      var o = !1;
      for (n = 0 | h.charCodeAt(d++); 92 === n && (d++, o = !0) || 10 !== n && 13 !== n && 34 !== n && n; n = 0 | h.charCodeAt(d++)) {}
      if (34 !== n) {
        throw error("StringValue");
      }
      return t = h.slice(a, d), ignored(), {
        kind: "StringValue",
        value: o ? JSON.parse(t) : t.slice(1, -1),
        block: !1
      };
    }

   case 45:
   case 48:
   case 49:
   case 50:
   case 51:
   case 52:
   case 53:
   case 54:
   case 55:
   case 56:
   case 57:
    var l = d++;
    var u;
    for (;(u = 0 | h.charCodeAt(d++)) >= 48 && u <= 57; ) {}
    var c = h.slice(l, --d);
    if (46 === (u = h.charCodeAt(d)) || 69 === u || 101 === u) {
      if (null == (t = advance(m))) {
        throw error("FloatValue");
      }
      return ignored(), {
        kind: "FloatValue",
        value: c + t
      };
    } else {
      return ignored(), {
        kind: "IntValue",
        value: c
      };
    }

   case 110:
    if (117 === h.charCodeAt(d + 1) && 108 === h.charCodeAt(d + 2) && 108 === h.charCodeAt(d + 3)) {
      return d += 4, ignored(), {
        kind: "NullValue"
      };
    } else {
      break;
    }

   case 116:
    if (114 === h.charCodeAt(d + 1) && 117 === h.charCodeAt(d + 2) && 101 === h.charCodeAt(d + 3)) {
      return d += 4, ignored(), {
        kind: "BooleanValue",
        value: !0
      };
    } else {
      break;
    }

   case 102:
    if (97 === h.charCodeAt(d + 1) && 108 === h.charCodeAt(d + 2) && 115 === h.charCodeAt(d + 3) && 101 === h.charCodeAt(d + 4)) {
      return d += 5, ignored(), {
        kind: "BooleanValue",
        value: !1
      };
    } else {
      break;
    }
  }
  return {
    kind: "EnumValue",
    value: name()
  };
}

function arguments_(e) {
  if (40 === h.charCodeAt(d)) {
    var t = [];
    d++, ignored();
    do {
      var i = nameNode();
      if (58 !== h.charCodeAt(d++)) {
        throw error("Argument");
      }
      ignored(), t.push({
        kind: "Argument",
        name: i,
        value: value(e)
      });
    } while (41 !== h.charCodeAt(d));
    return d++, ignored(), t;
  }
}

function directives(e) {
  if (64 === h.charCodeAt(d)) {
    var t = [];
    do {
      d++, t.push({
        kind: "Directive",
        name: nameNode(),
        arguments: arguments_(e)
      });
    } while (64 === h.charCodeAt(d));
    return t;
  }
}

function type() {
  var e = 0;
  for (;91 === h.charCodeAt(d); ) {
    e++, d++, ignored();
  }
  var t = {
    kind: "NamedType",
    name: nameNode()
  };
  do {
    if (33 === h.charCodeAt(d)) {
      d++, ignored(), t = {
        kind: "NonNullType",
        type: t
      };
    }
    if (e) {
      if (93 !== h.charCodeAt(d++)) {
        throw error("NamedType");
      }
      ignored(), t = {
        kind: "ListType",
        type: t
      };
    }
  } while (e--);
  return t;
}

function selectionSetStart() {
  if (123 !== h.charCodeAt(d++)) {
    throw error("SelectionSet");
  }
  return ignored(), selectionSet();
}

function selectionSet() {
  var e = [];
  do {
    if (46 === h.charCodeAt(d)) {
      if (46 !== h.charCodeAt(++d) || 46 !== h.charCodeAt(++d)) {
        throw error("SelectionSet");
      }
      switch (d++, ignored(), h.charCodeAt(d)) {
       case 64:
        e.push({
          kind: "InlineFragment",
          typeCondition: void 0,
          directives: directives(!1),
          selectionSet: selectionSetStart()
        });
        break;

       case 111:
        if (110 === h.charCodeAt(d + 1)) {
          d += 2, ignored(), e.push({
            kind: "InlineFragment",
            typeCondition: {
              kind: "NamedType",
              name: nameNode()
            },
            directives: directives(!1),
            selectionSet: selectionSetStart()
          });
        } else {
          e.push({
            kind: "FragmentSpread",
            name: nameNode(),
            directives: directives(!1)
          });
        }
        break;

       case 123:
        d++, ignored(), e.push({
          kind: "InlineFragment",
          typeCondition: void 0,
          directives: void 0,
          selectionSet: selectionSet()
        });
        break;

       default:
        e.push({
          kind: "FragmentSpread",
          name: nameNode(),
          directives: directives(!1)
        });
      }
    } else {
      var t = nameNode();
      var i = void 0;
      if (58 === h.charCodeAt(d)) {
        d++, ignored(), i = t, t = nameNode();
      }
      var r = arguments_(!1);
      var s = directives(!1);
      var a = void 0;
      if (123 === h.charCodeAt(d)) {
        d++, ignored(), a = selectionSet();
      }
      e.push({
        kind: "Field",
        alias: i,
        name: t,
        arguments: r,
        directives: s,
        selectionSet: a
      });
    }
  } while (125 !== h.charCodeAt(d));
  return d++, ignored(), {
    kind: "SelectionSet",
    selections: e
  };
}

function variableDefinitions() {
  if (ignored(), 40 === h.charCodeAt(d)) {
    var e = [];
    d++, ignored();
    do {
      var t = void 0;
      if (34 === h.charCodeAt(d)) {
        t = value(!0);
      }
      if (36 !== h.charCodeAt(d++)) {
        throw error("Variable");
      }
      var i = nameNode();
      if (58 !== h.charCodeAt(d++)) {
        throw error("VariableDefinition");
      }
      ignored();
      var r = type();
      var s = void 0;
      if (61 === h.charCodeAt(d)) {
        d++, ignored(), s = value(!0);
      }
      ignored();
      var a = {
        kind: "VariableDefinition",
        variable: {
          kind: "Variable",
          name: i
        },
        type: r,
        defaultValue: s,
        directives: directives(!0)
      };
      if (t) {
        a.description = t;
      }
      e.push(a);
    } while (41 !== h.charCodeAt(d));
    return d++, ignored(), e;
  }
}

function fragmentDefinition(e) {
  var t = nameNode();
  if (111 !== h.charCodeAt(d++) || 110 !== h.charCodeAt(d++)) {
    throw error("FragmentDefinition");
  }
  ignored();
  var i = {
    kind: "FragmentDefinition",
    name: t,
    typeCondition: {
      kind: "NamedType",
      name: nameNode()
    },
    directives: directives(!1),
    selectionSet: selectionSetStart()
  };
  if (e) {
    i.description = e;
  }
  return i;
}

function definitions() {
  var e = [];
  do {
    var t = void 0;
    if (34 === h.charCodeAt(d)) {
      t = value(!0);
    }
    if (123 === h.charCodeAt(d)) {
      if (t) {
        throw error("Document");
      }
      d++, ignored(), e.push({
        kind: "OperationDefinition",
        operation: "query",
        name: void 0,
        variableDefinitions: void 0,
        directives: void 0,
        selectionSet: selectionSet()
      });
    } else {
      var i = name();
      switch (i) {
       case "fragment":
        e.push(fragmentDefinition(t));
        break;

       case "query":
       case "mutation":
       case "subscription":
        var r;
        var s = void 0;
        if (40 !== (r = h.charCodeAt(d)) && 64 !== r && 123 !== r) {
          s = nameNode();
        }
        var a = {
          kind: "OperationDefinition",
          operation: i,
          name: s,
          variableDefinitions: variableDefinitions(),
          directives: directives(!1),
          selectionSet: selectionSetStart()
        };
        if (t) {
          a.description = t;
        }
        e.push(a);
        break;

       default:
        throw error("Document");
      }
    }
  } while (d < h.length);
  return e;
}

function parse(e, t) {
  if (h = e.body ? e.body : e, d = 0, ignored(), t && t.noLocation) {
    return {
      kind: "Document",
      definitions: definitions()
    };
  } else {
    return {
      kind: "Document",
      definitions: definitions(),
      loc: {
        start: 0,
        end: h.length,
        startToken: void 0,
        endToken: void 0,
        source: {
          body: h,
          name: "graphql.web",
          locationOffset: {
            line: 1,
            column: 1
          }
        }
      }
    };
  }
}

var x = {};

function visit(e, t) {
  var i = [];
  var r = [];
  try {
    var s = function traverse(e, s, a) {
      var n = !1;
      var o = t[e.kind] && t[e.kind].enter || t[e.kind] || t.enter;
      var l = o && o.call(t, e, s, a, r, i);
      if (!1 === l) {
        return e;
      } else if (null === l) {
        return null;
      } else if (l === x) {
        throw x;
      } else if (l && "string" == typeof l.kind) {
        n = l !== e, e = l;
      }
      if (a) {
        i.push(a);
      }
      var u;
      var c = {
        ...e
      };
      for (var f in e) {
        r.push(f);
        var h = e[f];
        if (Array.isArray(h)) {
          var d = [];
          for (var v = 0; v < h.length; v++) {
            if (null != h[v] && "string" == typeof h[v].kind) {
              if (i.push(e), r.push(v), u = traverse(h[v], v, h), r.pop(), i.pop(), null == u) {
                n = !0;
              } else {
                n = n || u !== h[v], d.push(u);
              }
            }
          }
          h = d;
        } else if (null != h && "string" == typeof h.kind) {
          if (void 0 !== (u = traverse(h, f, e))) {
            n = n || h !== u, h = u;
          }
        }
        if (r.pop(), n) {
          c[f] = h;
        }
      }
      if (a) {
        i.pop();
      }
      var g = t[e.kind] && t[e.kind].leave || t.leave;
      var m = g && g.call(t, e, s, a, r, i);
      if (m === x) {
        throw x;
      } else if (void 0 !== m) {
        return m;
      } else if (void 0 !== l) {
        return n ? c : l;
      } else {
        return n ? c : e;
      }
    }(e);
    return void 0 !== s && !1 !== s ? s : e;
  } catch (t) {
    if (t !== x) {
      throw t;
    }
    return e;
  }
}

function mapJoin(e, t, i) {
  var r = "";
  for (var s = 0; s < e.length; s++) {
    if (s) {
      r += t;
    }
    r += i(e[s]);
  }
  return r;
}

var S = "\n";

var y = {
  OperationDefinition(e) {
    var t = "";
    if (e.description) {
      t += y.StringValue(e.description) + "\n";
    }
    if (t += e.operation, e.name) {
      t += " " + e.name.value;
    }
    if (e.variableDefinitions && e.variableDefinitions.length) {
      if (!e.name) {
        t += " ";
      }
      t += "(" + mapJoin(e.variableDefinitions, ", ", y.VariableDefinition) + ")";
    }
    if (e.directives && e.directives.length) {
      t += " " + mapJoin(e.directives, " ", y.Directive);
    }
    var i = y.SelectionSet(e.selectionSet);
    return "query" !== t ? t + " " + i : i;
  },
  VariableDefinition(e) {
    var t = "";
    if (e.description) {
      t += y.StringValue(e.description) + " ";
    }
    if (t += y.Variable(e.variable) + ": " + _print(e.type), e.defaultValue) {
      t += " = " + _print(e.defaultValue);
    }
    if (e.directives && e.directives.length) {
      t += " " + mapJoin(e.directives, " ", y.Directive);
    }
    return t;
  },
  Field(e) {
    var t = e.alias ? e.alias.value + ": " + e.name.value : e.name.value;
    if (e.arguments && e.arguments.length) {
      var i = mapJoin(e.arguments, ", ", y.Argument);
      if (t.length + i.length + 2 > 80) {
        t += "(" + (S += "  ") + mapJoin(e.arguments, S, y.Argument) + (S = S.slice(0, -2)) + ")";
      } else {
        t += "(" + i + ")";
      }
    }
    if (e.directives && e.directives.length) {
      t += " " + mapJoin(e.directives, " ", y.Directive);
    }
    if (e.selectionSet && e.selectionSet.selections.length) {
      t += " " + y.SelectionSet(e.selectionSet);
    }
    return t;
  },
  StringValue(e) {
    if (e.block) {
      return function printBlockString(e) {
        return '"""\n' + e.replace(/"""/g, '\\"""') + '\n"""';
      }(e.value).replace(/\n/g, S);
    } else {
      return function printString(e) {
        return JSON.stringify(e);
      }(e.value);
    }
  },
  BooleanValue: e => "" + e.value,
  NullValue: e => "null",
  IntValue: e => e.value,
  FloatValue: e => e.value,
  EnumValue: e => e.value,
  Name: e => e.value,
  Variable: e => "$" + e.name.value,
  ListValue: e => "[" + mapJoin(e.values, ", ", _print) + "]",
  ObjectValue: e => "{" + mapJoin(e.fields, ", ", y.ObjectField) + "}",
  ObjectField: e => e.name.value + ": " + _print(e.value),
  Document(e) {
    if (!e.definitions || !e.definitions.length) {
      return "";
    } else {
      return mapJoin(e.definitions, "\n\n", _print);
    }
  },
  SelectionSet: e => "{" + (S += "  ") + mapJoin(e.selections, S, _print) + (S = S.slice(0, -2)) + "}",
  Argument: e => e.name.value + ": " + _print(e.value),
  FragmentSpread(e) {
    var t = "..." + e.name.value;
    if (e.directives && e.directives.length) {
      t += " " + mapJoin(e.directives, " ", y.Directive);
    }
    return t;
  },
  InlineFragment(e) {
    var t = "...";
    if (e.typeCondition) {
      t += " on " + e.typeCondition.name.value;
    }
    if (e.directives && e.directives.length) {
      t += " " + mapJoin(e.directives, " ", y.Directive);
    }
    return t + " " + y.SelectionSet(e.selectionSet);
  },
  FragmentDefinition(e) {
    var t = "";
    if (e.description) {
      t += y.StringValue(e.description) + "\n";
    }
    if (t += "fragment " + e.name.value, t += " on " + e.typeCondition.name.value, e.directives && e.directives.length) {
      t += " " + mapJoin(e.directives, " ", y.Directive);
    }
    return t + " " + y.SelectionSet(e.selectionSet);
  },
  Directive(e) {
    var t = "@" + e.name.value;
    if (e.arguments && e.arguments.length) {
      t += "(" + mapJoin(e.arguments, ", ", y.Argument) + ")";
    }
    return t;
  },
  NamedType: e => e.name.value,
  ListType: e => "[" + _print(e.type) + "]",
  NonNullType: e => _print(e.type) + "!"
};

var _print = e => y[e.kind](e);

function print(e) {
  return S = "\n", y[e.kind] ? y[e.kind](e) : "";
}

var T = new Set([ "gql", "graphql" ]);

var isIIFE = e => exports.ts.isCallExpression(e) && 0 === e.arguments.length && (exports.ts.isFunctionExpression(e.expression) || exports.ts.isArrowFunction(e.expression)) && !e.expression.asteriskToken && !e.expression.modifiers?.length;

var isGraphQLFunctionIdentifier = e => exports.ts.isIdentifier(e) && T.has(e.escapedText);

var E = new WeakMap;

var A = new WeakMap;

var getCached = (e, t, i, r) => {
  var s = t.getSymbolAtLocation(i);
  if (!s) {
    return r();
  }
  var a = e.get(t);
  if (!a) {
    e.set(t, a = new WeakMap);
  }
  var n = a.get(s);
  if (void 0 === n) {
    a.set(s, n = r());
  }
  return n;
};

var isTadaGraphQLFunction = (e, t) => {
  if (!exports.ts.isLeftHandSideExpression(e) || !t) {
    return !1;
  }
  return getCached(E, t, e, () => {
    var i = t.getTypeAtLocation(e);
    return null != i && null != i.getProperty("scalar") && null != i.getProperty("persisted");
  });
};

var b = /^(?:[\s,]+|#[^\n\r]*)*(?:\{|(?:query|mutation|subscription|fragment)(?=[\s,{(@#]|$))/;

var isTadaGraphQLCall = (e, t) => {
  if (!exports.ts.isCallExpression(e)) {
    return !1;
  } else if (e.arguments.length < 1 || e.arguments.length > 2) {
    return !1;
  } else if (!exports.ts.isStringLiteralLike(e.arguments[0])) {
    return !1;
  } else if (!b.test(e.arguments[0].text)) {
    return !1;
  }
  return t ? isTadaGraphQLFunction(e.expression, t) : !1;
};

var isTadaPersistedCall = (e, t) => {
  if (!e) {
    return !1;
  } else if (!exports.ts.isCallExpression(e)) {
    return !1;
  } else if (!exports.ts.isPropertyAccessExpression(e.expression)) {
    return !1;
  } else if (!exports.ts.isIdentifier(e.expression.name) || "persisted" !== e.expression.name.escapedText) {
    return !1;
  } else if (isGraphQLFunctionIdentifier(e.expression.expression)) {
    return !0;
  } else {
    return isTadaGraphQLFunction(e.expression.expression, t);
  }
};

var isGraphQLCall = (e, t) => exports.ts.isCallExpression(e) && e.arguments.length >= 1 && e.arguments.length <= 2 && (isGraphQLFunctionIdentifier(e.expression) || isTadaGraphQLCall(e, t));

var isGraphQLTag = e => exports.ts.isTaggedTemplateExpression(e) && isGraphQLFunctionIdentifier(e.tag);

var getSchemaName = (e, t, i = !1) => {
  if (!t) {
    return null;
  }
  var r = i ? e.getChildAt(0).getChildAt(0) : e.expression;
  return getCached(A, t, r, () => {
    var e = t.getTypeAtLocation(r);
    if (e) {
      var i = e.getProperty("__name");
      if (i) {
        var s = t.getTypeOfSymbol(i);
        if (s.isUnionOrIntersection()) {
          var a = s.types.find(e => e.isStringLiteral());
          return a && a.isStringLiteral() ? a.value : null;
        } else if (s.isStringLiteral()) {
          return s.value;
        }
      }
    }
    return null;
  });
};

function isValueDeclaration(e) {
  switch (e.kind) {
   case exports.ts.SyntaxKind.BinaryExpression:
   case exports.ts.SyntaxKind.ArrowFunction:
   case exports.ts.SyntaxKind.BindingElement:
   case exports.ts.SyntaxKind.ClassDeclaration:
   case exports.ts.SyntaxKind.ClassExpression:
   case exports.ts.SyntaxKind.ClassStaticBlockDeclaration:
   case exports.ts.SyntaxKind.Constructor:
   case exports.ts.SyntaxKind.EnumDeclaration:
   case exports.ts.SyntaxKind.EnumMember:
   case exports.ts.SyntaxKind.ExportAssignment:
   case exports.ts.SyntaxKind.FunctionDeclaration:
   case exports.ts.SyntaxKind.FunctionExpression:
   case exports.ts.SyntaxKind.GetAccessor:
   case exports.ts.SyntaxKind.JsxAttribute:
   case exports.ts.SyntaxKind.MethodDeclaration:
   case exports.ts.SyntaxKind.Parameter:
   case exports.ts.SyntaxKind.PropertyAssignment:
   case exports.ts.SyntaxKind.PropertyDeclaration:
   case exports.ts.SyntaxKind.SetAccessor:
   case exports.ts.SyntaxKind.ShorthandPropertyAssignment:
   case exports.ts.SyntaxKind.VariableDeclaration:
    return !0;

   default:
    return !1;
  }
}

function getValueOfValueDeclaration(e) {
  switch (e.kind) {
   case exports.ts.SyntaxKind.ClassExpression:
   case exports.ts.SyntaxKind.ClassDeclaration:
   case exports.ts.SyntaxKind.ArrowFunction:
   case exports.ts.SyntaxKind.ClassStaticBlockDeclaration:
   case exports.ts.SyntaxKind.Constructor:
   case exports.ts.SyntaxKind.EnumDeclaration:
   case exports.ts.SyntaxKind.FunctionDeclaration:
   case exports.ts.SyntaxKind.FunctionExpression:
   case exports.ts.SyntaxKind.GetAccessor:
   case exports.ts.SyntaxKind.SetAccessor:
   case exports.ts.SyntaxKind.MethodDeclaration:
    return e;

   case exports.ts.SyntaxKind.BindingElement:
   case exports.ts.SyntaxKind.EnumMember:
   case exports.ts.SyntaxKind.JsxAttribute:
   case exports.ts.SyntaxKind.Parameter:
   case exports.ts.SyntaxKind.PropertyAssignment:
   case exports.ts.SyntaxKind.PropertyDeclaration:
   case exports.ts.SyntaxKind.VariableDeclaration:
    return e.initializer;

   case exports.ts.SyntaxKind.ExportAssignment:
    return e.expression;

   case exports.ts.SyntaxKind.BinaryExpression:
    return function isAssignmentOperator(e) {
      switch (e.kind) {
       case exports.ts.SyntaxKind.EqualsToken:
       case exports.ts.SyntaxKind.BarBarEqualsToken:
       case exports.ts.SyntaxKind.AmpersandAmpersandEqualsToken:
       case exports.ts.SyntaxKind.QuestionQuestionEqualsToken:
        return !0;

       default:
        return !1;
      }
    }(e.operatorToken) ? e.right : void 0;

   case exports.ts.SyntaxKind.ShorthandPropertyAssignment:
    return e.objectAssignmentInitializer;

   default:
    return;
  }
}

function climbPastPropertyOrElementAccess(e) {
  if (e.parent && exports.ts.isPropertyAccessExpression(e.parent) && e.parent.name === e) {
    return e.parent;
  } else if (e.parent && exports.ts.isElementAccessExpression(e.parent) && e.parent.argumentExpression === e) {
    return e.parent;
  } else {
    return e;
  }
}

function getNameFromPropertyName(e) {
  if (exports.ts.isComputedPropertyName(e)) {
    return exports.ts.isStringLiteralLike(e.expression) || exports.ts.isNumericLiteral(e.expression) ? e.expression.text : void 0;
  } else if (exports.ts.isPrivateIdentifier(e) || exports.ts.isMemberName(e)) {
    return exports.ts.idText(e);
  } else {
    return e.text;
  }
}

function getDeclarationOfIdentifier(e, t) {
  var i = t.getSymbolAtLocation(e);
  if (i?.declarations?.[0] && i.flags & exports.ts.SymbolFlags.Alias && (e.parent === i?.declarations?.[0] || !exports.ts.isNamespaceImport(i.declarations[0]))) {
    var r = t.getAliasedSymbol(i);
    if (r.declarations) {
      i = r;
    }
  }
  if (i && exports.ts.isShorthandPropertyAssignment(e.parent)) {
    var s = t.getShorthandAssignmentValueSymbol(i.valueDeclaration);
    if (s) {
      i = s;
    }
  } else if (exports.ts.isBindingElement(e.parent) && exports.ts.isObjectBindingPattern(e.parent.parent) && e === (e.parent.propertyName || e.parent.name)) {
    var a = getNameFromPropertyName(e);
    var n = a ? t.getTypeAtLocation(e.parent.parent).getProperty(a) : void 0;
    if (n) {
      i = n;
    }
  } else if (exports.ts.isObjectLiteralElement(e.parent) && (exports.ts.isObjectLiteralExpression(e.parent.parent) || exports.ts.isJsxAttributes(e.parent.parent)) && e.parent.name === e) {
    var o = getNameFromPropertyName(e);
    var l = o ? t.getContextualType(e.parent.parent)?.getProperty(o) : void 0;
    if (l) {
      i = l;
    }
  }
  if (i && i.declarations?.length) {
    if (i.flags & exports.ts.SymbolFlags.Class && !(i.flags & (exports.ts.SymbolFlags.Function | exports.ts.SymbolFlags.Variable)) && function isNewExpressionTarget(e) {
      var t = climbPastPropertyOrElementAccess(e).parent;
      return exports.ts.isNewExpression(t) && t.expression === e;
    }(e)) {
      for (var u of i.declarations) {
        if (exports.ts.isClassLike(u)) {
          return u;
        }
      }
    } else if (function isCallOrNewExpressionTarget(e) {
      var t = climbPastPropertyOrElementAccess(e).parent;
      return exports.ts.isCallOrNewExpression(t) && t.expression === e;
    }(e) || function isNameOfFunctionDeclaration(e) {
      return exports.ts.isIdentifier(e) && e.parent && exports.ts.isFunctionLike(e.parent) && e.parent.name === e;
    }(e)) {
      for (var c of i.declarations) {
        if (exports.ts.isFunctionLike(c) && c.body && isValueDeclaration(c)) {
          return c;
        }
      }
    }
    if (i.valueDeclaration && exports.ts.isPropertyAccessExpression(i.valueDeclaration)) {
      var f = i.valueDeclaration.parent;
      if (f && exports.ts.isBinaryExpression(f) && f.left === i.valueDeclaration) {
        return f;
      }
    }
    if (i.valueDeclaration && isValueDeclaration(i.valueDeclaration)) {
      return i.valueDeclaration;
    }
    for (var h of i.declarations) {
      if (isValueDeclaration(h)) {
        return h;
      }
    }
  }
  return;
}

function getValueOfIdentifier(e, t) {
  while (exports.ts.isIdentifier(e)) {
    var i = getDeclarationOfIdentifier(e, t);
    if (!i) {
      return;
    } else {
      var r = getValueOfValueDeclaration(i);
      if (r && exports.ts.isIdentifier(r) && r !== e) {
        e = r;
      } else {
        return r;
      }
    }
  }
}

function resolveTemplate(e, t, i) {
  if (exports.ts.isStringLiteralLike(e)) {
    return {
      combinedText: e.getText().slice(1, -1),
      resolvedSpans: []
    };
  }
  var r = e.template.getText().slice(1, -1);
  if (exports.ts.isNoSubstitutionTemplateLiteral(e.template) || 0 === e.template.templateSpans.length) {
    return {
      combinedText: r,
      resolvedSpans: []
    };
  }
  var s = 0;
  var a = e.template.templateSpans.map(e => {
    if (exports.ts.isIdentifier(e.expression)) {
      var t = i.languageService.getProgram()?.getTypeChecker();
      if (!t) {
        return;
      }
      var a = getDeclarationOfIdentifier(e.expression, t);
      if (!a) {
        return;
      }
      var n = a;
      if (exports.ts.isVariableDeclaration(n)) {
        var o = e.expression.escapedText;
        var l = getValueOfValueDeclaration(n);
        if (!l) {
          return;
        }
        var u = e.expression.getStart() - 2;
        var c = {
          start: u,
          length: e.expression.end - u + 1
        };
        if (exports.ts.isTaggedTemplateExpression(l)) {
          var f = resolveTemplate(l, n.getSourceFile().fileName, i);
          r = r.replace("${" + e.expression.escapedText + "}", f.combinedText);
          var h = {
            lines: f.combinedText.split("\n").length,
            identifier: o,
            original: c,
            new: {
              start: c.start + s,
              length: f.combinedText.length
            }
          };
          s += f.combinedText.length - c.length;
          return h;
        } else if (exports.ts.isAsExpression(l) && exports.ts.isTaggedTemplateExpression(l.expression)) {
          var d = resolveTemplate(l.expression, n.getSourceFile().fileName, i);
          r = r.replace("${" + e.expression.escapedText + "}", d.combinedText);
          var v = {
            lines: d.combinedText.split("\n").length,
            identifier: o,
            original: c,
            new: {
              start: c.start + s,
              length: d.combinedText.length
            }
          };
          s += d.combinedText.length - c.length;
          return v;
        } else if (exports.ts.isAsExpression(l) && exports.ts.isAsExpression(l.expression) && exports.ts.isObjectLiteralExpression(l.expression.expression)) {
          var g = print(JSON.parse(l.expression.expression.getText()));
          r = r.replace("${" + e.expression.escapedText + "}", g);
          var m = {
            lines: g.split("\n").length,
            identifier: o,
            original: c,
            new: {
              start: c.start + s,
              length: g.length
            }
          };
          s += g.length - c.length;
          return m;
        }
        return;
      }
    }
    return;
  }).filter(Boolean);
  return {
    combinedText: r,
    resolvedSpans: a
  };
}

var resolveTadaFragmentArray = e => {
  if (!e) {
    return;
  }
  while (exports.ts.isAsExpression(e)) {
    e = e.expression;
  }
  if (!exports.ts.isArrayLiteralExpression(e)) {
    return;
  }
  if (e.elements.every(exports.ts.isIdentifier)) {
    return e.elements;
  }
  var t = [];
  for (var i of e.elements) {
    while (exports.ts.isPropertyAccessExpression(i)) {
      i = i.name;
    }
    if (exports.ts.isIdentifier(i)) {
      t.push(i);
    }
  }
  return t;
};

function getSource(e, t) {
  var i = e.languageService.getProgram();
  if (!i) {
    return;
  }
  var r = i.getSourceFile(t);
  if (!r) {
    return;
  }
  return r;
}

function findNode(e, t) {
  return function find(e) {
    if (t >= e.getStart() && t < e.getEnd()) {
      return exports.ts.forEachChild(e, find) || e;
    }
  }(e);
}

function findAllTaggedTemplateNodes(e) {
  var t = [];
  !function find(e) {
    if (isGraphQLTag(e) || exports.ts.isNoSubstitutionTemplateLiteral(e) && isGraphQLTag(e.parent)) {
      t.push(e);
      return;
    } else {
      exports.ts.forEachChild(e, find);
    }
  }(e);
  return t;
}

function unrollFragment(t, i, r) {
  var s = [];
  var a = [ t ];
  var n = new WeakSet;
  var _unrollElement = t => {
    if (n.has(t)) {
      return;
    }
    n.add(t);
    var i = function resolveIdentifierToGraphQLCall(e, t, i) {
      if (!i) {
        return null;
      }
      var r = getValueOfIdentifier(e, i);
      if (!r) {
        return null;
      }
      return isGraphQLCall(r, i) ? r : null;
    }(t, 0, r);
    if (!i) {
      return;
    }
    var o = resolveTadaFragmentArray(i.arguments[1]);
    if (o) {
      a.push(...o);
    }
    try {
      e.parse(i.arguments[0].getText().slice(1, -1), {
        noLocation: !0
      }).definitions.forEach(e => {
        if ("FragmentDefinition" === e.kind) {
          s.push(e);
        }
      });
    } catch (e) {}
  };
  var o;
  while (void 0 !== (o = a.shift())) {
    _unrollElement(o);
  }
  return s;
}

function unrollTadaFragments(e, t, i) {
  var r = i.languageService.getProgram()?.getTypeChecker();
  e.elements.forEach(e => {
    if (exports.ts.isIdentifier(e)) {
      t.push(...unrollFragment(e, 0, r));
    } else if (exports.ts.isPropertyAccessExpression(e)) {
      if (exports.ts.isIdentifier(e.name)) {
        t.push(...unrollFragment(e.name, 0, r));
      }
    }
  });
  return t;
}

function findAllCallExpressions(e, t, i = !0) {
  var {searchExternal: r = !0, collectFragments: s = !0} = "boolean" == typeof i ? {
    searchExternal: i
  } : i;
  var a = t.languageService.getProgram()?.getTypeChecker();
  var n = [];
  var o = [];
  var l = r ? !1 : !0;
  var u = new Map;
  var unrollFragmentMemoized = e => {
    var t = a && a.getSymbolAtLocation(e);
    if (!t) {
      return unrollFragment(e, 0, a);
    }
    var i = u.get(t);
    if (!i) {
      u.set(t, i = unrollFragment(e, 0, a));
    }
    return i;
  };
  !function find(e) {
    if (!exports.ts.isCallExpression(e) || isIIFE(e)) {
      return exports.ts.forEachChild(e, find);
    }
    if (!isGraphQLCall(e, a)) {
      return exports.ts.forEachChild(e, find);
    }
    var i = getSchemaName(e, a);
    var r = e.arguments[0];
    var u = resolveTadaFragmentArray(e.arguments[1]);
    var c = isTadaGraphQLCall(e, a);
    if (!s) {} else if (!l && !u) {
      if (!c) {
        l = !0;
        o.push(...getAllFragments(e, t));
      }
    } else if (u) {
      for (var f of u) {
        o.push(...unrollFragmentMemoized(f));
      }
    }
    if (r && exports.ts.isStringLiteralLike(r)) {
      n.push({
        node: r,
        schema: i,
        tadaFragmentRefs: c ? void 0 === u ? [] : u : void 0
      });
    }
  }(e);
  return {
    nodes: n,
    fragments: o
  };
}

function findAllPersistedCallExpressions(e, t) {
  var i = [];
  var r = t?.languageService.getProgram()?.getTypeChecker();
  !function find(e) {
    if (!exports.ts.isCallExpression(e) || isIIFE(e)) {
      return exports.ts.forEachChild(e, find);
    }
    if (!isTadaPersistedCall(e, r)) {
      return;
    } else if (t) {
      var s = getSchemaName(e, r, !0);
      i.push({
        node: e,
        schema: s
      });
    } else {
      i.push(e);
    }
  }(e);
  return i;
}

function getAllFragments(t, i) {
  var r = [];
  var s = i.languageService.getProgram()?.getTypeChecker();
  if (!exports.ts.isCallExpression(t)) {
    return r;
  }
  var a = resolveTadaFragmentArray(t.arguments[1]);
  if (a) {
    var n = i.languageService.getProgram()?.getTypeChecker();
    for (var o of a) {
      r.push(...unrollFragment(o, 0, n));
    }
    return r;
  } else if (isTadaGraphQLCall(t, s)) {
    return r;
  }
  if (!s) {
    return r;
  }
  var l = function getIdentifierOfChainExpression(e) {
    var t = e;
    while (t) {
      if (exports.ts.isPropertyAccessExpression(t)) {
        t = t.name;
      } else if (exports.ts.isAsExpression(t) || exports.ts.isSatisfiesExpression(t) || exports.ts.isNonNullExpression(t) || exports.ts.isParenthesizedExpression(t) || exports.ts.isExpressionWithTypeArguments(t)) {
        t = t.expression;
      } else if (exports.ts.isCommaListExpression(t)) {
        t = t.elements[t.elements.length - 1];
      } else if (exports.ts.isIdentifier(t)) {
        return t;
      } else {
        return;
      }
    }
  }(t.expression);
  if (!l) {
    return r;
  }
  var u = getDeclarationOfIdentifier(l, s);
  if (!u) {
    return r;
  }
  var c = u.getSourceFile();
  if (!c) {
    return r;
  }
  var f = [ {
    fileName: c.fileName,
    textSpan: {
      start: u.getStart(),
      length: u.getWidth()
    }
  } ];
  if (!f || !f.length) {
    return r;
  }
  var h = f[0];
  if (!h) {
    return r;
  }
  var d = getSource(i, h.fileName);
  if (!d) {
    return r;
  }
  exports.ts.forEachChild(d, t => {
    if (exports.ts.isVariableStatement(t) && t.declarationList && t.declarationList.declarations[0] && "documents" === t.declarationList.declarations[0].name.getText()) {
      var [i] = t.declarationList.declarations;
      if (i.initializer && exports.ts.isObjectLiteralExpression(i.initializer)) {
        i.initializer.properties.forEach(t => {
          if (exports.ts.isPropertyAssignment(t) && exports.ts.isStringLiteral(t.name)) {
            try {
              var i = JSON.parse(`${t.name.getText().replace(/'/g, '"')}`);
              if (i.includes("fragment ") && i.includes(" on ")) {
                e.parse(i, {
                  noLocation: !0
                }).definitions.forEach(e => {
                  if ("FragmentDefinition" === e.kind) {
                    r.push(e);
                  }
                });
              }
            } catch (e) {}
          }
        });
      }
    }
  });
  return r;
}

function findAllImports(e) {
  return e.statements.filter(exports.ts.isImportDeclaration);
}

var k = "object" == typeof performance && performance && "function" == typeof performance.now ? performance : Date;

var C = new Set;

var w = "object" == typeof process && process ? process : {};

var emitWarning = (e, t, i, r) => {
  "function" == typeof w.emitWarning ? w.emitWarning(e, t, i, r) : console.error(`[${i}] ${t}: ${e}`);
};

var D = globalThis.AbortController;

var L = globalThis.AbortSignal;

if (void 0 === D) {
  L = class AbortSignal {
    _onabort=[];
    aborted=!1;
    addEventListener(e, t) {
      this._onabort.push(t);
    }
  };
  D = class AbortController {
    constructor() {
      warnACPolyfill();
    }
    signal=new L;
    abort(e) {
      if (this.signal.aborted) {
        return;
      }
      this.signal.reason = e;
      this.signal.aborted = !0;
      for (var t of this.signal._onabort) {
        t(e);
      }
      this.signal.onabort?.(e);
    }
  };
  var F = "1" !== w.env?.LRU_CACHE_IGNORE_AC_WARNING;
  var warnACPolyfill = () => {
    if (!F) {
      return;
    }
    F = !1;
    emitWarning("AbortController is not defined. If using lru-cache in node 14, load an AbortController polyfill from the `node-abort-controller` package. A minimal polyfill is provided for use by LRUCache.fetch(), but it should not be relied upon in other contexts (eg, passing it to other APIs that use AbortController/AbortSignal might have undesirable effects). You may disable this with LRU_CACHE_IGNORE_AC_WARNING=1 in the env.", "NO_ABORT_CONTROLLER", "ENOTSUP", warnACPolyfill);
  };
}

var isPosInt = e => e && e === Math.floor(e) && e > 0 && isFinite(e);

var getUintArray = e => !isPosInt(e) ? null : e <= Math.pow(2, 8) ? Uint8Array : e <= Math.pow(2, 16) ? Uint16Array : e <= Math.pow(2, 32) ? Uint32Array : e <= Number.MAX_SAFE_INTEGER ? ZeroArray : null;

class ZeroArray extends Array {
  constructor(e) {
    super(e);
    this.fill(0);
  }
}

class Stack {
  static #e=!1;
  static create(e) {
    var t = getUintArray(e);
    if (!t) {
      return [];
    }
    Stack.#e = !0;
    var i = new Stack(e, t);
    Stack.#e = !1;
    return i;
  }
  constructor(e, t) {
    if (!Stack.#e) {
      throw new TypeError("instantiate Stack using Stack.create(n)");
    }
    this.heap = new t(e);
    this.length = 0;
  }
  push(e) {
    this.heap[this.length++] = e;
  }
  pop() {
    return this.heap[--this.length];
  }
}

class LRUCache {
  #t;
  #i;
  #r;
  #s;
  #a;
  #n;
  #o;
  #l;
  #u;
  #p;
  #c;
  #f;
  #h;
  #d;
  #v;
  #g;
  #m;
  #x;
  #S;
  #y;
  #T;
  #E;
  static unsafeExposeInternals(e) {
    return {
      starts: e.#x,
      ttls: e.#S,
      sizes: e.#m,
      keyMap: e.#l,
      keyList: e.#u,
      valList: e.#p,
      next: e.#c,
      prev: e.#f,
      get head() {
        return e.#h;
      },
      get tail() {
        return e.#d;
      },
      free: e.#v,
      isBackgroundFetch: t => e.#A(t),
      backgroundFetch: (t, i, r, s) => e.#b(t, i, r, s),
      moveToTail: t => e.#k(t),
      indexes: t => e.#C(t),
      rindexes: t => e.#w(t),
      isStale: t => e.#D(t)
    };
  }
  get max() {
    return this.#t;
  }
  get maxSize() {
    return this.#i;
  }
  get calculatedSize() {
    return this.#o;
  }
  get size() {
    return this.#n;
  }
  get fetchMethod() {
    return this.#a;
  }
  get dispose() {
    return this.#r;
  }
  get disposeAfter() {
    return this.#s;
  }
  constructor(e) {
    var {max: t = 0, ttl: i, ttlResolution: r = 1, ttlAutopurge: s, updateAgeOnGet: a, updateAgeOnHas: n, allowStale: o, dispose: l, disposeAfter: u, noDisposeOnSet: c, noUpdateTTL: f, maxSize: h = 0, maxEntrySize: d = 0, sizeCalculation: v, fetchMethod: g, noDeleteOnFetchRejection: m, noDeleteOnStaleGet: x, allowStaleOnFetchRejection: S, allowStaleOnFetchAbort: y, ignoreFetchAbort: T} = e;
    if (0 !== t && !isPosInt(t)) {
      throw new TypeError("max option must be a nonnegative integer");
    }
    var E = t ? getUintArray(t) : Array;
    if (!E) {
      throw new Error("invalid max value: " + t);
    }
    this.#t = t;
    this.#i = h;
    this.maxEntrySize = d || this.#i;
    this.sizeCalculation = v;
    if (this.sizeCalculation) {
      if (!this.#i && !this.maxEntrySize) {
        throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
      }
      if ("function" != typeof this.sizeCalculation) {
        throw new TypeError("sizeCalculation set to non-function");
      }
    }
    if (void 0 !== g && "function" != typeof g) {
      throw new TypeError("fetchMethod must be a function if specified");
    }
    this.#a = g;
    this.#T = !!g;
    this.#l = new Map;
    this.#u = new Array(t).fill(void 0);
    this.#p = new Array(t).fill(void 0);
    this.#c = new E(t);
    this.#f = new E(t);
    this.#h = 0;
    this.#d = 0;
    this.#v = Stack.create(t);
    this.#n = 0;
    this.#o = 0;
    if ("function" == typeof l) {
      this.#r = l;
    }
    if ("function" == typeof u) {
      this.#s = u;
      this.#g = [];
    } else {
      this.#s = void 0;
      this.#g = void 0;
    }
    this.#y = !!this.#r;
    this.#E = !!this.#s;
    this.noDisposeOnSet = !!c;
    this.noUpdateTTL = !!f;
    this.noDeleteOnFetchRejection = !!m;
    this.allowStaleOnFetchRejection = !!S;
    this.allowStaleOnFetchAbort = !!y;
    this.ignoreFetchAbort = !!T;
    if (0 !== this.maxEntrySize) {
      if (0 !== this.#i) {
        if (!isPosInt(this.#i)) {
          throw new TypeError("maxSize must be a positive integer if specified");
        }
      }
      if (!isPosInt(this.maxEntrySize)) {
        throw new TypeError("maxEntrySize must be a positive integer if specified");
      }
      this.#L();
    }
    this.allowStale = !!o;
    this.noDeleteOnStaleGet = !!x;
    this.updateAgeOnGet = !!a;
    this.updateAgeOnHas = !!n;
    this.ttlResolution = isPosInt(r) || 0 === r ? r : 1;
    this.ttlAutopurge = !!s;
    this.ttl = i || 0;
    if (this.ttl) {
      if (!isPosInt(this.ttl)) {
        throw new TypeError("ttl must be a positive integer if specified");
      }
      this.#F();
    }
    if (0 === this.#t && 0 === this.ttl && 0 === this.#i) {
      throw new TypeError("At least one of max, maxSize, or ttl is required");
    }
    if (!this.ttlAutopurge && !this.#t && !this.#i) {
      var A = "LRU_CACHE_UNBOUNDED";
      if ((e => !C.has(e))(A)) {
        C.add(A);
        emitWarning("TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.", "UnboundedCacheWarning", A, LRUCache);
      }
    }
  }
  getRemainingTTL(e) {
    return this.#l.has(e) ? 1 / 0 : 0;
  }
  #F() {
    var e = new ZeroArray(this.#t);
    var t = new ZeroArray(this.#t);
    this.#S = e;
    this.#x = t;
    this.#N = (i, r, s = k.now()) => {
      t[i] = 0 !== r ? s : 0;
      e[i] = r;
      if (0 !== r && this.ttlAutopurge) {
        var a = setTimeout(() => {
          if (this.#D(i)) {
            this.delete(this.#u[i]);
          }
        }, r + 1);
        if (a.unref) {
          a.unref();
        }
      }
    };
    this.#_ = i => {
      t[i] = 0 !== e[i] ? k.now() : 0;
    };
    this.#I = (r, s) => {
      if (e[s]) {
        var a = e[s];
        var n = t[s];
        r.ttl = a;
        r.start = n;
        r.now = i || getNow();
        r.remainingTTL = a - (r.now - n);
      }
    };
    var i = 0;
    var getNow = () => {
      var e = k.now();
      if (this.ttlResolution > 0) {
        i = e;
        var t = setTimeout(() => i = 0, this.ttlResolution);
        if (t.unref) {
          t.unref();
        }
      }
      return e;
    };
    this.getRemainingTTL = r => {
      var s = this.#l.get(r);
      if (void 0 === s) {
        return 0;
      }
      var a = e[s];
      var n = t[s];
      if (0 === a || 0 === n) {
        return 1 / 0;
      }
      return a - ((i || getNow()) - n);
    };
    this.#D = r => 0 !== e[r] && 0 !== t[r] && (i || getNow()) - t[r] > e[r];
  }
  #_=() => {};
  #I=() => {};
  #N=() => {};
  #D=() => !1;
  #L() {
    var e = new ZeroArray(this.#t);
    this.#o = 0;
    this.#m = e;
    this.#O = t => {
      this.#o -= e[t];
      e[t] = 0;
    };
    this.#z = (e, t, i, r) => {
      if (this.#A(t)) {
        return 0;
      }
      if (!isPosInt(i)) {
        if (r) {
          if ("function" != typeof r) {
            throw new TypeError("sizeCalculation must be a function");
          }
          i = r(t, e);
          if (!isPosInt(i)) {
            throw new TypeError("sizeCalculation return invalid (expect positive integer)");
          }
        } else {
          throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
        }
      }
      return i;
    };
    this.#P = (t, i, r) => {
      e[t] = i;
      if (this.#i) {
        var s = this.#i - e[t];
        while (this.#o > s) {
          this.#V(!0);
        }
      }
      this.#o += e[t];
      if (r) {
        r.entrySize = i;
        r.totalCalculatedSize = this.#o;
      }
    };
  }
  #O=e => {};
  #P=(e, t, i) => {};
  #z=(e, t, i, r) => {
    if (i || r) {
      throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
    }
    return 0;
  };
  * #C({allowStale: e = this.allowStale} = {}) {
    if (this.#n) {
      for (var t = this.#d; 1; ) {
        if (!this.#R(t)) {
          break;
        }
        if (e || !this.#D(t)) {
          yield t;
        }
        if (t === this.#h) {
          break;
        } else {
          t = this.#f[t];
        }
      }
    }
  }
  * #w({allowStale: e = this.allowStale} = {}) {
    if (this.#n) {
      for (var t = this.#h; 1; ) {
        if (!this.#R(t)) {
          break;
        }
        if (e || !this.#D(t)) {
          yield t;
        }
        if (t === this.#d) {
          break;
        } else {
          t = this.#c[t];
        }
      }
    }
  }
  #R(e) {
    return void 0 !== e && this.#l.get(this.#u[e]) === e;
  }
  * entries() {
    for (var e of this.#C()) {
      if (void 0 !== this.#p[e] && void 0 !== this.#u[e] && !this.#A(this.#p[e])) {
        yield [ this.#u[e], this.#p[e] ];
      }
    }
  }
  * rentries() {
    for (var e of this.#w()) {
      if (void 0 !== this.#p[e] && void 0 !== this.#u[e] && !this.#A(this.#p[e])) {
        yield [ this.#u[e], this.#p[e] ];
      }
    }
  }
  * keys() {
    for (var e of this.#C()) {
      var t = this.#u[e];
      if (void 0 !== t && !this.#A(this.#p[e])) {
        yield t;
      }
    }
  }
  * rkeys() {
    for (var e of this.#w()) {
      var t = this.#u[e];
      if (void 0 !== t && !this.#A(this.#p[e])) {
        yield t;
      }
    }
  }
  * values() {
    for (var e of this.#C()) {
      if (void 0 !== this.#p[e] && !this.#A(this.#p[e])) {
        yield this.#p[e];
      }
    }
  }
  * rvalues() {
    for (var e of this.#w()) {
      if (void 0 !== this.#p[e] && !this.#A(this.#p[e])) {
        yield this.#p[e];
      }
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  find(e, t = {}) {
    for (var i of this.#C()) {
      var r = this.#p[i];
      var s = this.#A(r) ? r.__staleWhileFetching : r;
      if (void 0 === s) {
        continue;
      }
      if (e(s, this.#u[i], this)) {
        return this.get(this.#u[i], t);
      }
    }
  }
  forEach(e, t = this) {
    for (var i of this.#C()) {
      var r = this.#p[i];
      var s = this.#A(r) ? r.__staleWhileFetching : r;
      if (void 0 === s) {
        continue;
      }
      e.call(t, s, this.#u[i], this);
    }
  }
  rforEach(e, t = this) {
    for (var i of this.#w()) {
      var r = this.#p[i];
      var s = this.#A(r) ? r.__staleWhileFetching : r;
      if (void 0 === s) {
        continue;
      }
      e.call(t, s, this.#u[i], this);
    }
  }
  purgeStale() {
    var e = !1;
    for (var t of this.#w({
      allowStale: !0
    })) {
      if (this.#D(t)) {
        this.delete(this.#u[t]);
        e = !0;
      }
    }
    return e;
  }
  dump() {
    var e = [];
    for (var t of this.#C({
      allowStale: !0
    })) {
      var i = this.#u[t];
      var r = this.#p[t];
      var s = this.#A(r) ? r.__staleWhileFetching : r;
      if (void 0 === s || void 0 === i) {
        continue;
      }
      var a = {
        value: s
      };
      if (this.#S && this.#x) {
        a.ttl = this.#S[t];
        var n = k.now() - this.#x[t];
        a.start = Math.floor(Date.now() - n);
      }
      if (this.#m) {
        a.size = this.#m[t];
      }
      e.unshift([ i, a ]);
    }
    return e;
  }
  load(e) {
    this.clear();
    for (var [t, i] of e) {
      if (i.start) {
        var r = Date.now() - i.start;
        i.start = k.now() - r;
      }
      this.set(t, i.value, i);
    }
  }
  set(e, t, i = {}) {
    if (void 0 === t) {
      this.delete(e);
      return this;
    }
    var {ttl: r = this.ttl, start: s, noDisposeOnSet: a = this.noDisposeOnSet, sizeCalculation: n = this.sizeCalculation, status: o} = i;
    var {noUpdateTTL: l = this.noUpdateTTL} = i;
    var u = this.#z(e, t, i.size || 0, n);
    if (this.maxEntrySize && u > this.maxEntrySize) {
      if (o) {
        o.set = "miss";
        o.maxEntrySizeExceeded = !0;
      }
      this.delete(e);
      return this;
    }
    var c = 0 === this.#n ? void 0 : this.#l.get(e);
    if (void 0 === c) {
      c = 0 === this.#n ? this.#d : 0 !== this.#v.length ? this.#v.pop() : this.#n === this.#t ? this.#V(!1) : this.#n;
      this.#u[c] = e;
      this.#p[c] = t;
      this.#l.set(e, c);
      this.#c[this.#d] = c;
      this.#f[c] = this.#d;
      this.#d = c;
      this.#n++;
      this.#P(c, u, o);
      if (o) {
        o.set = "add";
      }
      l = !1;
    } else {
      this.#k(c);
      var f = this.#p[c];
      if (t !== f) {
        if (this.#T && this.#A(f)) {
          f.__abortController.abort(new Error("replaced"));
          var {__staleWhileFetching: h} = f;
          if (void 0 !== h && !a) {
            if (this.#y) {
              this.#r?.(h, e, "set");
            }
            if (this.#E) {
              this.#g?.push([ h, e, "set" ]);
            }
          }
        } else if (!a) {
          if (this.#y) {
            this.#r?.(f, e, "set");
          }
          if (this.#E) {
            this.#g?.push([ f, e, "set" ]);
          }
        }
        this.#O(c);
        this.#P(c, u, o);
        this.#p[c] = t;
        if (o) {
          o.set = "replace";
          var d = f && this.#A(f) ? f.__staleWhileFetching : f;
          if (void 0 !== d) {
            o.oldValue = d;
          }
        }
      } else if (o) {
        o.set = "update";
      }
    }
    if (0 !== r && !this.#S) {
      this.#F();
    }
    if (this.#S) {
      if (!l) {
        this.#N(c, r, s);
      }
      if (o) {
        this.#I(o, c);
      }
    }
    if (!a && this.#E && this.#g) {
      var v = this.#g;
      var g;
      while (g = v?.shift()) {
        this.#s?.(...g);
      }
    }
    return this;
  }
  pop() {
    try {
      while (this.#n) {
        var e = this.#p[this.#h];
        this.#V(!0);
        if (this.#A(e)) {
          if (e.__staleWhileFetching) {
            return e.__staleWhileFetching;
          }
        } else if (void 0 !== e) {
          return e;
        }
      }
    } finally {
      if (this.#E && this.#g) {
        var t = this.#g;
        var i;
        while (i = t?.shift()) {
          this.#s?.(...i);
        }
      }
    }
  }
  #V(e) {
    var t = this.#h;
    var i = this.#u[t];
    var r = this.#p[t];
    if (this.#T && this.#A(r)) {
      r.__abortController.abort(new Error("evicted"));
    } else if (this.#y || this.#E) {
      if (this.#y) {
        this.#r?.(r, i, "evict");
      }
      if (this.#E) {
        this.#g?.push([ r, i, "evict" ]);
      }
    }
    this.#O(t);
    if (e) {
      this.#u[t] = void 0;
      this.#p[t] = void 0;
      this.#v.push(t);
    }
    if (1 === this.#n) {
      this.#h = this.#d = 0;
      this.#v.length = 0;
    } else {
      this.#h = this.#c[t];
    }
    this.#l.delete(i);
    this.#n--;
    return t;
  }
  has(e, t = {}) {
    var {updateAgeOnHas: i = this.updateAgeOnHas, status: r} = t;
    var s = this.#l.get(e);
    if (void 0 !== s) {
      var a = this.#p[s];
      if (this.#A(a) && void 0 === a.__staleWhileFetching) {
        return !1;
      }
      if (!this.#D(s)) {
        if (i) {
          this.#_(s);
        }
        if (r) {
          r.has = "hit";
          this.#I(r, s);
        }
        return !0;
      } else if (r) {
        r.has = "stale";
        this.#I(r, s);
      }
    } else if (r) {
      r.has = "miss";
    }
    return !1;
  }
  peek(e, t = {}) {
    var {allowStale: i = this.allowStale} = t;
    var r = this.#l.get(e);
    if (void 0 !== r && (i || !this.#D(r))) {
      var s = this.#p[r];
      return this.#A(s) ? s.__staleWhileFetching : s;
    }
  }
  #b(e, t, i, r) {
    var s = void 0 === t ? void 0 : this.#p[t];
    if (this.#A(s)) {
      return s;
    }
    var a = new D;
    var {signal: n} = i;
    n?.addEventListener("abort", () => a.abort(n.reason), {
      signal: a.signal
    });
    var o = {
      signal: a.signal,
      options: i,
      context: r
    };
    var cb = (r, s = !1) => {
      var {aborted: n} = a.signal;
      var u = i.ignoreFetchAbort && void 0 !== r;
      if (i.status) {
        if (n && !s) {
          i.status.fetchAborted = !0;
          i.status.fetchError = a.signal.reason;
          if (u) {
            i.status.fetchAbortIgnored = !0;
          }
        } else {
          i.status.fetchResolved = !0;
        }
      }
      if (n && !u && !s) {
        return fetchFail(a.signal.reason);
      }
      if (this.#p[t] === l) {
        if (void 0 === r) {
          if (l.__staleWhileFetching) {
            this.#p[t] = l.__staleWhileFetching;
          } else {
            this.delete(e);
          }
        } else {
          if (i.status) {
            i.status.fetchUpdated = !0;
          }
          this.set(e, r, o.options);
        }
      }
      return r;
    };
    var fetchFail = r => {
      var {aborted: s} = a.signal;
      var n = s && i.allowStaleOnFetchAbort;
      var o = n || i.allowStaleOnFetchRejection;
      var u = l;
      if (this.#p[t] === l) {
        if (!(o || i.noDeleteOnFetchRejection) || void 0 === u.__staleWhileFetching) {
          this.delete(e);
        } else if (!n) {
          this.#p[t] = u.__staleWhileFetching;
        }
      }
      if (o) {
        if (i.status && void 0 !== u.__staleWhileFetching) {
          i.status.returnedStale = !0;
        }
        return u.__staleWhileFetching;
      } else if (u.__returned === u) {
        throw r;
      }
    };
    if (i.status) {
      i.status.fetchDispatched = !0;
    }
    var l = new Promise((t, r) => {
      var n = this.#a?.(e, s, o);
      if (n && n instanceof Promise) {
        n.then(e => t(void 0 === e ? void 0 : e), r);
      }
      a.signal.addEventListener("abort", () => {
        if (!i.ignoreFetchAbort || i.allowStaleOnFetchAbort) {
          t(void 0);
          if (i.allowStaleOnFetchAbort) {
            t = e => cb(e, !0);
          }
        }
      });
    }).then(cb, e => {
      if (i.status) {
        i.status.fetchRejected = !0;
        i.status.fetchError = e;
      }
      return fetchFail(e);
    });
    var u = Object.assign(l, {
      __abortController: a,
      __staleWhileFetching: s,
      __returned: void 0
    });
    if (void 0 === t) {
      this.set(e, u, {
        ...o.options,
        status: void 0
      });
      t = this.#l.get(e);
    } else {
      this.#p[t] = u;
    }
    return u;
  }
  #A(e) {
    if (!this.#T) {
      return !1;
    }
    var t = e;
    return !!t && t instanceof Promise && t.hasOwnProperty("__staleWhileFetching") && t.__abortController instanceof D;
  }
  async fetch(e, t = {}) {
    var {allowStale: i = this.allowStale, updateAgeOnGet: r = this.updateAgeOnGet, noDeleteOnStaleGet: s = this.noDeleteOnStaleGet, ttl: a = this.ttl, noDisposeOnSet: n = this.noDisposeOnSet, size: o = 0, sizeCalculation: l = this.sizeCalculation, noUpdateTTL: u = this.noUpdateTTL, noDeleteOnFetchRejection: c = this.noDeleteOnFetchRejection, allowStaleOnFetchRejection: f = this.allowStaleOnFetchRejection, ignoreFetchAbort: h = this.ignoreFetchAbort, allowStaleOnFetchAbort: d = this.allowStaleOnFetchAbort, context: v, forceRefresh: g = !1, status: m, signal: x} = t;
    if (!this.#T) {
      if (m) {
        m.fetch = "get";
      }
      return this.get(e, {
        allowStale: i,
        updateAgeOnGet: r,
        noDeleteOnStaleGet: s,
        status: m
      });
    }
    var S = {
      allowStale: i,
      updateAgeOnGet: r,
      noDeleteOnStaleGet: s,
      ttl: a,
      noDisposeOnSet: n,
      size: o,
      sizeCalculation: l,
      noUpdateTTL: u,
      noDeleteOnFetchRejection: c,
      allowStaleOnFetchRejection: f,
      allowStaleOnFetchAbort: d,
      ignoreFetchAbort: h,
      status: m,
      signal: x
    };
    var y = this.#l.get(e);
    if (void 0 === y) {
      if (m) {
        m.fetch = "miss";
      }
      var T = this.#b(e, y, S, v);
      return T.__returned = T;
    } else {
      var E = this.#p[y];
      if (this.#A(E)) {
        var A = i && void 0 !== E.__staleWhileFetching;
        if (m) {
          m.fetch = "inflight";
          if (A) {
            m.returnedStale = !0;
          }
        }
        return A ? E.__staleWhileFetching : E.__returned = E;
      }
      var b = this.#D(y);
      if (!g && !b) {
        if (m) {
          m.fetch = "hit";
        }
        this.#k(y);
        if (r) {
          this.#_(y);
        }
        if (m) {
          this.#I(m, y);
        }
        return E;
      }
      var k = this.#b(e, y, S, v);
      var C = void 0 !== k.__staleWhileFetching && i;
      if (m) {
        m.fetch = b ? "stale" : "refresh";
        if (C && b) {
          m.returnedStale = !0;
        }
      }
      return C ? k.__staleWhileFetching : k.__returned = k;
    }
  }
  get(e, t = {}) {
    var {allowStale: i = this.allowStale, updateAgeOnGet: r = this.updateAgeOnGet, noDeleteOnStaleGet: s = this.noDeleteOnStaleGet, status: a} = t;
    var n = this.#l.get(e);
    if (void 0 !== n) {
      var o = this.#p[n];
      var l = this.#A(o);
      if (a) {
        this.#I(a, n);
      }
      if (this.#D(n)) {
        if (a) {
          a.get = "stale";
        }
        if (!l) {
          if (!s) {
            this.delete(e);
          }
          if (a && i) {
            a.returnedStale = !0;
          }
          return i ? o : void 0;
        } else {
          if (a && i && void 0 !== o.__staleWhileFetching) {
            a.returnedStale = !0;
          }
          return i ? o.__staleWhileFetching : void 0;
        }
      } else {
        if (a) {
          a.get = "hit";
        }
        if (l) {
          return o.__staleWhileFetching;
        }
        this.#k(n);
        if (r) {
          this.#_(n);
        }
        return o;
      }
    } else if (a) {
      a.get = "miss";
    }
  }
  #M(e, t) {
    this.#f[t] = e;
    this.#c[e] = t;
  }
  #k(e) {
    if (e !== this.#d) {
      if (e === this.#h) {
        this.#h = this.#c[e];
      } else {
        this.#M(this.#f[e], this.#c[e]);
      }
      this.#M(this.#d, e);
      this.#d = e;
    }
  }
  delete(e) {
    var t = !1;
    if (0 !== this.#n) {
      var i = this.#l.get(e);
      if (void 0 !== i) {
        t = !0;
        if (1 === this.#n) {
          this.clear();
        } else {
          this.#O(i);
          var r = this.#p[i];
          if (this.#A(r)) {
            r.__abortController.abort(new Error("deleted"));
          } else if (this.#y || this.#E) {
            if (this.#y) {
              this.#r?.(r, e, "delete");
            }
            if (this.#E) {
              this.#g?.push([ r, e, "delete" ]);
            }
          }
          this.#l.delete(e);
          this.#u[i] = void 0;
          this.#p[i] = void 0;
          if (i === this.#d) {
            this.#d = this.#f[i];
          } else if (i === this.#h) {
            this.#h = this.#c[i];
          } else {
            this.#c[this.#f[i]] = this.#c[i];
            this.#f[this.#c[i]] = this.#f[i];
          }
          this.#n--;
          this.#v.push(i);
        }
      }
    }
    if (this.#E && this.#g?.length) {
      var s = this.#g;
      var a;
      while (a = s?.shift()) {
        this.#s?.(...a);
      }
    }
    return t;
  }
  clear() {
    for (var e of this.#w({
      allowStale: !0
    })) {
      var t = this.#p[e];
      if (this.#A(t)) {
        t.__abortController.abort(new Error("deleted"));
      } else {
        var i = this.#u[e];
        if (this.#y) {
          this.#r?.(t, i, "delete");
        }
        if (this.#E) {
          this.#g?.push([ t, i, "delete" ]);
        }
      }
    }
    this.#l.clear();
    this.#p.fill(void 0);
    this.#u.fill(void 0);
    if (this.#S && this.#x) {
      this.#S.fill(0);
      this.#x.fill(0);
    }
    if (this.#m) {
      this.#m.fill(0);
    }
    this.#h = 0;
    this.#d = 0;
    this.#v.length = 0;
    this.#o = 0;
    this.#n = 0;
    if (this.#E && this.#g) {
      var r = this.#g;
      var s;
      while (s = r?.shift()) {
        this.#s?.(...s);
      }
    }
  }
}

var N = {
  exports: {}
};

var _ = {
  32: 16777619n,
  64: 1099511628211n,
  128: 309485009821345068724781371n,
  256: 374144419156711147060143317175368453031918731002211n,
  512: 35835915874844867368919076489095108449946327955754392558399825615420669938882575126094039892345713852759n,
  1024: 5016456510113118655434598811035278955030765345404790744303017523831112055108147451509157692220295382716162651878526895249385292291816524375083746691371804094271873160484737966720260389217684476157468082573n
};

var I = {
  32: 2166136261n,
  64: 14695981039346656037n,
  128: 144066263297769815596495629667062367629n,
  256: 100029257958052580907070968620625704837092796014241193945225284501741471925557n,
  512: 9659303129496669498009435400716310466090418745672637896108374329434462657994582932197716438449813051892206539805784495328239340083876191928701583869517785n,
  1024: 14197795064947621068722070641403218320880622795441933960878474914617582723252296732303717722150864096521202355549365628174669108571814760471015076148029755969804077320157692458563003215304957150157403644460363550505412711285966361610267868082893823963790439336411086884584107735010676915n
};

N.exports = function fnv1a(e) {
  var t = Number(I[32]);
  var i = !1;
  for (var r = 0; r < e.length; r++) {
    var s = e.charCodeAt(r);
    if (s > 127 && !i) {
      s = (e = unescape(encodeURIComponent(e))).charCodeAt(r);
      i = !0;
    }
    t ^= s;
    t += (t << 1) + (t << 4) + (t << 7) + (t << 8) + (t << 24);
  }
  return t >>> 0;
};

N.exports.bigInt = function bigInt(e, {size: t = 32} = {}) {
  if (!_[t]) {
    throw new Error("The `size` option must be one of 32, 64, 128, 256, 512, or 1024");
  }
  var i = I[t];
  var r = _[t];
  var s = !1;
  for (var a = 0; a < e.length; a++) {
    var n = e.charCodeAt(a);
    if (n > 127 && !s) {
      n = (e = unescape(encodeURIComponent(e))).charCodeAt(a);
      s = !0;
    }
    i ^= BigInt(n);
    i = BigInt.asUintN(t, i * r);
  }
  return i;
};

var O = getDefaultExportFromCjs(N.exports);

var z = 52005;

var unwrapAbstractType = e => e.isUnionOrIntersection() ? e.types.find(e => e.flags & exports.ts.TypeFlags.Object) || e : e;

var getVariableDeclaration = e => {
  var t = e;
  var i = new Set;
  while (t.parent && !i.has(t)) {
    i.add(t);
    if (exports.ts.isBlock(t)) {
      return;
    } else if (exports.ts.isVariableDeclaration(t = t.parent)) {
      return t;
    }
  }
};

var P = new Set([ "map", "filter", "forEach", "reduce", "every", "some", "find", "flatMap", "sort" ]);

var resolveDataType = (e, t) => {
  var i;
  var r = t.getTypeAtLocation(e.parent);
  if ("target" in r) {
    var s = r.resolvedTypeArguments;
    i = s && s.length > 1 ? s[0] : void 0;
  }
  if (!i) {
    var a = r.getProperty("__apiType");
    if (a) {
      var n = t.getTypeOfSymbol(a);
      var o = r.getCallSignatures()[0];
      if (n.isUnionOrIntersection()) {
        for (var l of n.types) {
          if (o = l.getCallSignatures()[0]) {
            i = o.getReturnType();
            break;
          }
        }
      }
      i = o && o.getReturnType();
    }
  }
  return i;
};

function getFragmentsInSource(t, i, r) {
  var s = [];
  var a = findAllCallExpressions(t, r, !1);
  var n = i.getSymbolAtLocation(t);
  if (!n) {
    return [];
  }
  var o = i.getExportsOfModule(n).map(e => e.name);
  a.nodes.filter(e => {
    var t = e.node.parent;
    while (t && !exports.ts.isSourceFile(t) && !exports.ts.isVariableDeclaration(t)) {
      t = t.parent;
    }
    if (exports.ts.isVariableDeclaration(t)) {
      return o.includes(t.name.getText());
    } else {
      return !1;
    }
  }).forEach(t => {
    var i = resolveTemplate(t.node, 0, r).combinedText;
    try {
      var a = e.parse(i, {
        noLocation: !0
      });
      if (a.definitions.every(t => t.kind === e.Kind.FRAGMENT_DEFINITION)) {
        s = s.concat(a.definitions);
      }
    } catch (e) {
      return;
    }
  });
  return s;
}

var generateHashForDocument = (e, i, r, s) => {
  if (s) {
    var a = [];
    unrollTadaFragments(s, a, e);
    var n = resolveTemplate(i, 0, e).combinedText;
    var o = parse(n);
    var l = new Set;
    for (var u of o.definitions) {
      if (u.kind === f && !l.has(u)) {
        stripUnmaskDirectivesFromDefinition(u);
      }
    }
    a.map(e => {
      stripUnmaskDirectivesFromDefinition(e);
      return print(e);
    }).filter((e, t, i) => i.indexOf(e) === t).forEach(e => {
      n = `${n}\n\n${e}`;
    });
    var c = print(parse(n));
    return t.createHash("sha256").update(c).digest("hex");
  } else {
    var h = getSource(e, r);
    var {fragments: d} = findAllCallExpressions(h, e);
    var v = resolveTemplate(i, 0, e).combinedText;
    var g = parse(v);
    var m = new Set;
    for (var x of g.definitions) {
      if (x.kind === f && !m.has(x)) {
        stripUnmaskDirectivesFromDefinition(x);
      }
    }
    var S = new Set;
    visit(g, {
      FragmentDefinition: e => {
        d.push(e);
      },
      FragmentSpread: e => {
        S.add(e.name.value);
      }
    });
    var y = v;
    var T = new Set;
    var E = [ ...S ];
    var A;
    while (A = E.shift()) {
      T.add(A);
      var b = d.find(e => e.name.value === A);
      if (!b) {
        e.project.projectService.logger.info(`[GraphQLSP] could not find fragment for spread ${A}!`);
        return;
      }
      stripUnmaskDirectivesFromDefinition(b);
      visit(b, {
        FragmentSpread: e => {
          if (!T.has(e.name.value)) {
            E.push(e.name.value);
          }
        }
      });
      y = `${y}\n\n${print(b)}`;
    }
    return t.createHash("sha256").update(print(parse(y))).digest("hex");
  }
};

var getDocumentReferenceFromTypeQuery = (e, t, i) => {
  var r = i.languageService.getProgram()?.getTypeChecker();
  if (!r) {
    return {
      node: null,
      filename: t
    };
  }
  var s;
  if (exports.ts.isIdentifier(e.exprName)) {
    s = e.exprName;
  } else if (exports.ts.isQualifiedName(e.exprName)) {
    s = e.exprName.right;
  }
  if (!s) {
    return {
      node: null,
      filename: t
    };
  }
  var a = getValueOfIdentifier(s, r);
  if (!a || !isGraphQLCall(a, r)) {
    return {
      node: null,
      filename: t
    };
  }
  return {
    node: a,
    filename: a.getSourceFile().fileName
  };
};

var getDocumentReferenceFromDocumentNode = (e, t, i) => {
  if (exports.ts.isIdentifier(e)) {
    var r = i.languageService.getProgram()?.getTypeChecker();
    if (!r) {
      return {
        node: null,
        filename: t
      };
    }
    var s = getValueOfIdentifier(e, r);
    if (!s || !isGraphQLCall(s, r)) {
      return {
        node: null,
        filename: t
      };
    }
    return {
      node: s,
      filename: s.getSourceFile().fileName
    };
  } else {
    return {
      node: e,
      filename: t
    };
  }
};

var stripUnmaskDirectivesFromDefinition = e => {
  e.directives = e.directives?.filter(e => "_unmask" !== e.name.value);
};

var V = new Set([ "populate", "client", "unmask", "_unmask", "_optional", "_relayPagination", "_simplePagination", "_required", "optional", "required", "arguments", "argumentDefinitions", "connection", "refetchable", "relay", "required", "inline" ]);

var R = 520100;

var M = 520101;

var B = 520102;

var $ = 520103;

var K = [ 52001, 52004, 52003, z, 52006, 52007, 52008, R, M, B, $ ];

var getMisconfigurationDiagnostics = (e, t, i, r) => {
  if (!i.errors || !t.length) {
    return [];
  }
  var s = [];
  var a = t[0].node;
  var n = [ i.errors.config, ...i.errors.load.values(), ...i.errors.write.values() ].filter(Boolean);
  var o = r.languageService.getProgram();
  if (o) {
    for (var [l, u] of i.outputLocations) {
      if (Date.now() - u > 3e4 && !o.getSourceFile(l)) {
        n.push(`The generated typings file "${l}" is not part of the TypeScript project. Check that it is matched by the "include" patterns of your tsconfig.json.`);
      }
    }
  }
  for (var c of n) {
    s.push({
      category: exports.ts.DiagnosticCategory.Error,
      code: 52006,
      file: e,
      messageText: c,
      start: a.getStart(),
      length: a.getEnd() - a.getStart()
    });
  }
  if (!!i.current || Object.values(i.multi).some(Boolean)) {
    var f = Object.keys(i.multi);
    for (var {node: h, schema: d} of t) {
      if (d && !f.includes(d)) {
        s.push({
          category: exports.ts.DiagnosticCategory.Error,
          code: 52008,
          file: e,
          messageText: `This document refers to the schema named "${d}", which isn't configured. ` + (f.length ? `Configured schemas are: ${f.join(", ")}.` : 'No named schemas are configured in the "schemas" option.'),
          start: h.getStart(),
          length: h.getEnd() - h.getStart()
        });
      }
    }
  }
  return s;
};

var j = new LRUCache({
  ttl: 9e5,
  max: 5e3
});

var runDiagnostics = (t, {nodes: i, fragments: r}, s, a) => {
  var n = a.config.templateIsCallExpression ?? !0;
  var o = a.languageService.getProgram()?.getTypeChecker();
  var l = i.map(t => {
    var i = t.node;
    if (!n && (exports.ts.isNoSubstitutionTemplateLiteral(i) || exports.ts.isTemplateExpression(i))) {
      if (exports.ts.isTaggedTemplateExpression(i.parent)) {
        i = i.parent;
      } else {
        return;
      }
    }
    var {combinedText: l, resolvedSpans: u} = resolveTemplate(i, 0, a);
    var c = l.split("\n");
    var f = !1;
    if (exports.ts.isAsExpression(i.parent)) {
      if (exports.ts.isExpressionStatement(i.parent.parent)) {
        f = !0;
      }
    } else if (exports.ts.isExpressionStatement(i.parent)) {
      f = !0;
    }
    var h = i.getStart() + (n ? 0 : i.tag.getText().length + (f ? 2 : 0));
    var d = h + i.getText().length;
    var v = [ ...r ];
    if (null != t.tadaFragmentRefs) {
      var g = new Set;
      for (var m of t.tadaFragmentRefs) {
        unrollFragment(m, 0, o).forEach(e => g.add(e.name.value));
      }
      v = v.filter(e => g.has(e.name.value));
    }
    if (n) {
      try {
        var x = e.parse(l, {
          noLocation: !0
        }).definitions.filter(t => t.kind === e.Kind.FRAGMENT_DEFINITION);
        v = v.filter(t => !x.some(i => i.kind === e.Kind.FRAGMENT_DEFINITION && i.name.value === t.name.value));
      } catch (e) {}
    }
    var S = t.schema && s.multi[t.schema] ? s.multi[t.schema]?.schema : s.current?.schema;
    if (!S) {
      return;
    }
    var y = new Set([ ...V, ...a.config.clientDirectives || [] ]);
    var T = getDiagnostics(l, S, void 0, void 0, v).filter(e => {
      if (!e.message.includes("Unknown directive")) {
        return !0;
      }
      var [t] = e.message.split("(");
      var i = t && /Unknown directive "@([^)]+)"/g.exec(t);
      if (!i) {
        return !0;
      }
      var r = i[1];
      return r && !y.has(r);
    }).map(e => {
      var {start: t, end: i} = e.range;
      var r = h + t.line;
      for (var s = 0; s <= t.line && s < c.length; s++) {
        if (s === t.line) {
          r += t.character;
        } else if (c[s]) {
          r += c[s].length;
        }
      }
      var a = h + i.line;
      for (var n = 0; n <= i.line && n < c.length; n++) {
        if (n === i.line) {
          a += i.character;
        } else if (c[n]) {
          a += c[n].length;
        }
      }
      var o = u.find(e => r >= e.new.start && a <= e.new.start + e.new.length);
      if (o) {
        return {
          ...e,
          start: o.original.start,
          length: o.original.length
        };
      } else if (r > d) {
        var l = u.filter(e => e.new.start + e.new.length < r).reduce((e, t) => e + (t.new.length - t.original.length), 0);
        r -= l;
        a -= l;
        return {
          ...e,
          start: r + 1,
          length: a - r
        };
      } else {
        return {
          ...e,
          start: r + 1,
          length: a - r
        };
      }
    }).filter(e => e.start + e.length <= d);
    return T;
  }).flat().filter(Boolean);
  var u = l.map(e => ({
    file: t,
    length: e.length,
    start: e.start,
    category: 2 === e.severity ? exports.ts.DiagnosticCategory.Warning : exports.ts.DiagnosticCategory.Error,
    code: "number" == typeof e.code ? e.code : 2 === e.severity ? 52004 : 52001,
    messageText: e.message.split("\n")[0]
  }));
  if (n) {
    var c = ((t, i, r) => {
      var s = [];
      if (!(r.config.trackFieldUsage ?? 1)) {
        return s;
      }
      var a = new Set([ "id", "_id", "__typename", ...r.config.reservedKeys ?? [] ]);
      var n = r.languageService.getProgram()?.getTypeChecker();
      if (!n) {
        return;
      }
      try {
        var o = 0;
        var makeTrieNode = e => ({
          id: o++,
          children: new Map,
          isLeaf: e,
          used: !1
        });
        var l = [];
        var _loop = function() {
          var t = u.getText();
          if (t.includes("mutation") || t.includes("subscription")) {
            return 0;
          }
          var i;
          try {
            i = e.parse(t.slice(1, -1));
          } catch (e) {
            return 0;
          }
          var r = makeTrieNode(!1);
          var s = [];
          var n = new Map;
          var o = new Map;
          var c = [];
          var f = [ r ];
          e.visit(i, {
            Field: {
              enter(e) {
                var t = e.alias ? e.alias.value : e.name.value;
                var i = c.length ? `${c.join(".")}.${t}` : t;
                var r = f[f.length - 1];
                if (!e.selectionSet && !a.has(e.name.value)) {
                  s.push(i);
                  o.set(i, {
                    start: e.name.loc.start,
                    length: e.name.loc.end - e.name.loc.start
                  });
                  var l = r.children.get(t);
                  if (!l) {
                    r.children.set(t, l = makeTrieNode(!0));
                  } else {
                    l.isLeaf = !0;
                  }
                  n.set(i, l);
                } else if (e.selectionSet) {
                  c.push(t);
                  o.set(i, {
                    start: e.name.loc.start,
                    length: e.name.loc.end - e.name.loc.start
                  });
                  var u = r.children.get(t);
                  if (!u) {
                    r.children.set(t, u = makeTrieNode(!1));
                  }
                  f.push(u);
                }
              },
              leave(e) {
                if (e.selectionSet) {
                  c.pop();
                  f.pop();
                }
              }
            }
          });
          l.push({
            root: r,
            allPaths: s,
            leafByPath: n,
            fieldToLoc: o,
            templateNode: u,
            accessCount: 0
          });
        };
        for (var u of i) {
          if (0 === _loop()) {
            continue;
          }
        }
        if (!l.length) {
          return s;
        }
        var c = new Map;
        var f = [];
        var indexWalk = e => {
          if (exports.ts.isTypeNode(e)) {
            return;
          }
          if (exports.ts.isIdentifier(e)) {
            var t = e.parent;
            var i = t && (exports.ts.isVariableDeclaration(t) || exports.ts.isBindingElement(t) || exports.ts.isParameter(t) || exports.ts.isFunctionDeclaration(t) || exports.ts.isFunctionExpression(t) || exports.ts.isClassDeclaration(t) || exports.ts.isImportSpecifier(t) || exports.ts.isImportClause(t) || exports.ts.isNamespaceImport(t) || exports.ts.isExportSpecifier(t)) && t.name === e;
            var r = t && (exports.ts.isPropertyAccessExpression(t) && t.name === e || exports.ts.isQualifiedName(t) && t.right === e || exports.ts.isPropertyAssignment(t) && t.name === e || exports.ts.isBindingElement(t) && t.propertyName === e || exports.ts.isJsxAttribute(t) && t.name === e || exports.ts.isPropertyDeclaration(t) && t.name === e || exports.ts.isMethodDeclaration(t) && t.name === e || exports.ts.isPropertySignature(t) && t.name === e || exports.ts.isMethodSignature(t) && t.name === e || exports.ts.isEnumMember(t) && t.name === e);
            if (!i && !r) {
              var s = c.get(e.text);
              if (!s) {
                c.set(e.text, s = []);
              }
              s.push(e);
            }
            return;
          }
          if (exports.ts.isVariableDeclaration(e) && e.initializer) {
            var a = e.initializer;
            while (exports.ts.isParenthesizedExpression(a) || exports.ts.isAwaitExpression(a) || exports.ts.isNonNullExpression(a) || exports.ts.isAsExpression(a)) {
              a = a.expression;
            }
            if (exports.ts.isCallExpression(a)) {
              f.push(e);
            }
          }
          exports.ts.forEachChild(e, indexWalk);
        };
        indexWalk(t);
        var h = new Map;
        var getRefSymbol = e => {
          if (h.has(e)) {
            return h.get(e);
          }
          var t = exports.ts.isShorthandPropertyAssignment(e.parent) && e.parent.name === e ? n.getShorthandAssignmentValueSymbol(e.parent) : n.getSymbolAtLocation(e);
          h.set(e, t);
          return t;
        };
        var d = [];
        var v = new Map;
        var addEntry = (e, t, i, r) => {
          if (!e) {
            return;
          }
          var s = v.get(e);
          if (!s) {
            v.set(e, s = new Set);
          }
          var a = `${t.id}${r ? "s" : ""}`;
          if (s.has(a)) {
            return;
          }
          s.add(a);
          d.push({
            symbol: e,
            node: t,
            doc: i,
            suppressReturnBail: r
          });
        };
        var trackBinding = (e, t, i, r) => {
          if (exports.ts.isIdentifier(e)) {
            addEntry(n.getSymbolAtLocation(e), t, i, r);
          } else if (exports.ts.isObjectBindingPattern(e)) {
            for (var s of e.elements) {
              var a = void 0;
              if (s.propertyName) {
                if (exports.ts.isIdentifier(s.propertyName) || exports.ts.isStringLiteral(s.propertyName)) {
                  a = s.propertyName.text;
                }
              } else if (exports.ts.isIdentifier(s.name)) {
                a = s.name.text;
              }
              var o = a && t.children.get(a) || t;
              trackBinding(s.name, o, i, r);
            }
          } else {
            for (var l of e.elements) {
              if (exports.ts.isOmittedExpression(l)) {
                continue;
              }
              trackBinding(l.name, t, i, r);
            }
          }
        };
        var markSubtreeUsed = e => {
          for (var t of e.children.values()) {
            t.used = !0;
            markSubtreeUsed(t);
          }
        };
        var handleArrayChain = (e, t, i, r) => {
          var s = e;
          while (1) {
            var a = s.expression.name.text;
            var o = s.arguments[0];
            if (o && exports.ts.isIdentifier(o)) {
              var l = getValueOfIdentifier(o, n);
              if (l && (exports.ts.isFunctionDeclaration(l) || exports.ts.isFunctionExpression(l) || exports.ts.isArrowFunction(l))) {
                o = l;
              }
            }
            if (o && (exports.ts.isFunctionDeclaration(o) || exports.ts.isFunctionExpression(o) || exports.ts.isArrowFunction(o))) {
              var u = o.parameters["reduce" === a ? 1 : 0];
              if (u) {
                trackBinding(u.name, i, r, !0);
              }
            }
            var c = s.parent;
            if (exports.ts.isPropertyAccessExpression(c) && c.expression === s && P.has(c.name.text) && exports.ts.isCallExpression(c.parent) && c.parent.expression === c) {
              s = c.parent;
              continue;
            }
            break;
          }
          if (exports.ts.isVariableDeclaration(e.parent) && "some" !== t && "every" !== t) {
            trackBinding(e.parent.name, i, r, !0);
          }
        };
        var walkUseChain = (e, t) => {
          var i = t.doc;
          var r = e;
          var s = t.node;
          var a = !0;
          while (1) {
            var o = r.parent;
            if (!o) {
              break;
            }
            if (exports.ts.isPropertyAccessExpression(o)) {
              if (o.expression !== r) {
                break;
              }
              var l = o.name.text;
              var u = o.parent;
              if (exports.ts.isCallExpression(u) && u.expression === o) {
                if ("at" === l) {
                  r = u;
                  continue;
                } else if (P.has(l)) {
                  handleArrayChain(u, l, s, i);
                  i.accessCount++;
                  return;
                }
              }
              s = s.children.get(l) || s;
              r = o;
              continue;
            }
            if (exports.ts.isElementAccessExpression(o)) {
              if (o.expression !== r) {
                break;
              }
              if (exports.ts.isStringLiteral(o.argumentExpression)) {
                s = s.children.get(o.argumentExpression.text) || s;
              }
              r = o;
              continue;
            }
            if (exports.ts.isNonNullExpression(o) || exports.ts.isParenthesizedExpression(o) || exports.ts.isAsExpression(o) || exports.ts.isAwaitExpression(o) || exports.ts.isSatisfiesExpression && exports.ts.isSatisfiesExpression(o)) {
              r = o;
              continue;
            }
            if (exports.ts.isBinaryExpression(o)) {
              if (o.operatorToken.kind === exports.ts.SyntaxKind.EqualsToken) {
                if (o.left === r) {
                  return;
                }
                if (exports.ts.isIdentifier(o.left)) {
                  addEntry(n.getSymbolAtLocation(o.left), s, i, !1);
                  i.accessCount++;
                  return;
                }
                if (a) {
                  if (s.isLeaf) {
                    s.used = !0;
                  }
                  markSubtreeUsed(s);
                  i.accessCount++;
                  return;
                }
                break;
              }
              if (o.operatorToken.kind !== exports.ts.SyntaxKind.BarBarToken && o.operatorToken.kind !== exports.ts.SyntaxKind.QuestionQuestionToken) {
                a = !1;
              }
              r = o;
              continue;
            }
            if (exports.ts.isConditionalExpression(o)) {
              if (o.condition === r) {
                break;
              }
              a = !1;
              r = o;
              continue;
            }
            if (exports.ts.isVariableDeclaration(o)) {
              trackBinding(o.name, s, i, !1);
              return;
            }
            if (exports.ts.isForOfStatement(o) && o.expression === r) {
              if (exports.ts.isVariableDeclarationList(o.initializer)) {
                for (var c of o.initializer.declarations) {
                  trackBinding(c.name, s, i, !1);
                }
              } else if (exports.ts.isIdentifier(o.initializer)) {
                addEntry(n.getSymbolAtLocation(o.initializer), s, i, !1);
              }
              i.accessCount++;
              return;
            }
            if (exports.ts.isReturnStatement(o) || exports.ts.isArrowFunction(o) && o.body === r) {
              if (s.isLeaf) {
                s.used = !0;
              }
              if (!t.suppressReturnBail) {
                markSubtreeUsed(s);
              }
              i.accessCount++;
              return;
            }
            if (exports.ts.isCallExpression(o) && o.expression !== r) {
              if (s.isLeaf) {
                s.used = !0;
              }
              if (a) {
                markSubtreeUsed(s);
              }
              i.accessCount++;
              return;
            }
            if (a && (exports.ts.isSpreadElement(o) || exports.ts.isSpreadAssignment(o) || exports.ts.isJsxSpreadAttribute(o) || exports.ts.isShorthandPropertyAssignment(o) || exports.ts.isPropertyAssignment(o) && o.initializer === r)) {
              if (s.isLeaf) {
                s.used = !0;
              }
              markSubtreeUsed(s);
              i.accessCount++;
              return;
            }
            break;
          }
          if (s.isLeaf) {
            s.used = !0;
          }
          i.accessCount++;
        };
        var g = new Map;
        for (var m of l) {
          var x = m.templateNode;
          var S = void 0;
          var y = x.parent.parent;
          while (exports.ts.isParenthesizedExpression(y) || exports.ts.isAsExpression(y) || exports.ts.isNonNullExpression(y) || exports.ts.isSatisfiesExpression && exports.ts.isSatisfiesExpression(y)) {
            y = y.parent;
          }
          if (exports.ts.isVariableDeclaration(y)) {
            S = y;
          }
          if (S && exports.ts.isIdentifier(S.name)) {
            var T = n.getSymbolAtLocation(S.name);
            if (T) {
              var E = c.get(S.name.text) || [];
              for (var A of E) {
                if (getRefSymbol(A) !== T) {
                  continue;
                }
                var b = getVariableDeclaration(A);
                if (!b || b === S) {
                  continue;
                }
                trackBinding(b.name, m.root, m, !1);
              }
            }
          } else if (!S) {
            var k = getVariableDeclaration(x);
            if (k && exports.ts.isIdentifier(k.name)) {
              addEntry(n.getSymbolAtLocation(k.name), m.root, m, !1);
            }
          }
          var C = resolveDataType(x, n);
          if (C) {
            for (var w of f) {
              if (w === S) {
                continue;
              }
              var D = g.get(w);
              if (!D) {
                var L = unwrapAbstractType(n.getTypeAtLocation(w.initializer));
                D = {
                  type: L
                };
                if (L.flags & exports.ts.TypeFlags.Object) {
                  var F = L.getProperty("0");
                  if (F) {
                    D.tupleType = n.getTypeOfSymbol(F);
                  }
                  var N = (D.tupleType || L).getProperty("data");
                  if (N) {
                    D.dataType = unwrapAbstractType(n.getTypeOfSymbol(N));
                  }
                }
                g.set(w, D);
              }
              if (D.type === C || D.tupleType === C || D.dataType === C) {
                trackBinding(w.name, m.root, m, !1);
              }
            }
          }
        }
        for (var _ = 0; _ < d.length; _++) {
          var I = d[_];
          var O = c.get(I.symbol.name);
          if (!O) {
            continue;
          }
          for (var V of O) {
            if (getRefSymbol(V) !== I.symbol) {
              continue;
            }
            walkUseChain(V, I);
          }
        }
        var _loop2 = function(e) {
          if (!e.accessCount) {
            return 1;
          }
          var i = e.templateNode;
          var r = e.fieldToLoc;
          var a = e.allPaths.filter(t => !e.leafByPath.get(t).used);
          var n = new Set;
          var o = {};
          var l = new Set;
          a.forEach(e => {
            var t = e.split(".");
            t.pop();
            var i = t.join(".");
            if (r.get(i)) {
              n.add(i);
              if (o[i]) {
                o[i].add(e);
              } else {
                o[i] = new Set([ e ]);
              }
            } else {
              l.add(e);
            }
          });
          n.forEach(e => {
            var a = r.get(e);
            var n = o[e];
            s.push({
              file: t,
              length: a.length,
              start: i.getStart() + a.start + 1,
              category: exports.ts.DiagnosticCategory.Warning,
              code: z,
              messageText: `Field(s) ${[ ...n ].map(e => `'${e}'`).join(", ")} are not used.`
            });
          });
          l.forEach(e => {
            var a = r.get(e);
            s.push({
              file: t,
              length: a.length,
              start: i.getStart() + a.start + 1,
              category: exports.ts.DiagnosticCategory.Warning,
              code: z,
              messageText: `Field ${e} is not used.`
            });
          });
        };
        for (var R of l) {
          if (_loop2(R)) {
            continue;
          }
        }
      } catch (e) {
        console.error("[GraphQLSP]: ", e.message, e.stack);
      }
      return s;
    })(t, i.map(e => e.node), a) || [];
    if (!c) {
      return u;
    }
    return [ ...u, ...c ];
  } else {
    return u;
  }
};

exports.ALL_DIAGNOSTICS = K;

exports.CharacterStream = CharacterStream;

exports.bubbleUpCallExpression = function bubbleUpCallExpression(e) {
  while (exports.ts.isStringLiteralLike(e) || exports.ts.isToken(e) || exports.ts.isTemplateExpression(e) || exports.ts.isTemplateSpan(e)) {
    e = e.parent;
  }
  return e;
};

exports.bubbleUpTemplate = function bubbleUpTemplate(e) {
  while (exports.ts.isNoSubstitutionTemplateLiteral(e) || exports.ts.isToken(e) || exports.ts.isTemplateExpression(e) || exports.ts.isTemplateSpan(e)) {
    e = e.parent;
  }
  return e;
};

exports.findAllCallExpressions = findAllCallExpressions;

exports.findAllPersistedCallExpressions = findAllPersistedCallExpressions;

exports.findNode = findNode;

exports.getAllFragments = getAllFragments;

exports.getDocumentReferenceFromDocumentNode = getDocumentReferenceFromDocumentNode;

exports.getDocumentReferenceFromTypeQuery = getDocumentReferenceFromTypeQuery;

exports.getGraphQLDiagnostics = function getGraphQLDiagnostics(t, i, r) {
  var s = r.config.templateIsCallExpression ?? !0;
  var a = getSource(r, t);
  if (!a) {
    return;
  }
  var n, o = [];
  if (s) {
    var l = findAllCallExpressions(a, r);
    o = l.fragments;
    n = l.nodes;
  } else {
    n = findAllTaggedTemplateNodes(a).map(e => ({
      node: e,
      schema: null
    }));
  }
  var u = n.map(({node: e}) => {
    if ((exports.ts.isNoSubstitutionTemplateLiteral(e) || exports.ts.isTemplateExpression(e)) && !s) {
      if (exports.ts.isTaggedTemplateExpression(e.parent)) {
        e = e.parent;
      } else {
        return;
      }
    }
    return resolveTemplate(e, 0, r).combinedText;
  });
  var c = O(s ? a.getText() + o.map(e => print(e)).join("-") + i.version : u.join("-") + i.version);
  var f;
  if (j.has(c)) {
    f = j.get(c);
  } else {
    f = runDiagnostics(a, {
      nodes: n,
      fragments: o
    }, i, r);
    j.set(c, f);
  }
  f = [ ...getMisconfigurationDiagnostics(a, n, i, r), ...f ];
  if (!n.length) {
    var h = ((e, t, i) => {
      if (!new RegExp(`\\b(?:${Array.from(T).join("|")})\\s*${t ? "`" : "\\("}`).test(e.getText())) {
        return null;
      }
      var r;
      var s;
      if (t) {
        r = findAllTaggedTemplateNodes(e)[0];
        s = 'Found GraphQL documents in tagged templates, but GraphQLSP is configured to search for graphql()/gql() calls. If you use tagged templates, set "templateIsCallExpression": false in the plugin configuration in your tsconfig.json.';
      } else {
        r = findAllCallExpressions(e, i, {
          searchExternal: !1,
          collectFragments: !1
        }).nodes.find(e => /^[\s,]*(?:query|mutation|subscription|fragment|\{)/.test(e.node.text))?.node;
        s = 'Found GraphQL documents in graphql()/gql() calls, but GraphQLSP is configured to search for tagged templates. If you use call expressions, remove "templateIsCallExpression": false from the plugin configuration in your tsconfig.json.';
      }
      if (!r) {
        return null;
      }
      return {
        category: exports.ts.DiagnosticCategory.Warning,
        code: 52007,
        file: e,
        messageText: s,
        start: r.getStart(),
        length: r.getEnd() - r.getStart()
      };
    })(a, s, r);
    if (h) {
      f.unshift(h);
    }
  }
  var d = r.config.shouldCheckForColocatedFragments ?? !0;
  var v = [];
  if (s) {
    var g = findAllPersistedCallExpressions(a, r).map(e => {
      var {node: i} = e;
      if (!i.typeArguments && !i.arguments[1]) {
        return {
          category: exports.ts.DiagnosticCategory.Warning,
          code: R,
          file: a,
          messageText: "Missing generic pointing at the GraphQL document.",
          start: i.getStart(),
          length: i.getEnd() - i.getStart()
        };
      }
      var s, n, o, l, u = t;
      var c = i.typeArguments && i.typeArguments[0];
      if (c) {
        o = c.getStart();
        l = c.getEnd() - c.getStart();
        if (!exports.ts.isTypeQueryNode(c)) {
          return {
            category: exports.ts.DiagnosticCategory.Warning,
            code: R,
            file: a,
            messageText: "Provided generic should be a typeQueryNode in the shape of graphql.persisted<typeof document>.",
            start: o,
            length: l
          };
        }
        var {node: f, filename: h} = getDocumentReferenceFromTypeQuery(c, t, r);
        s = f;
        u = h;
        n = c.getText();
      } else if (i.arguments[1]) {
        o = i.arguments[1].getStart();
        l = i.arguments[1].getEnd() - i.arguments[1].getStart();
        if (!exports.ts.isIdentifier(i.arguments[1]) && !exports.ts.isCallExpression(i.arguments[1])) {
          return {
            category: exports.ts.DiagnosticCategory.Warning,
            code: R,
            file: a,
            messageText: 'Provided argument should be an identifier or invocation of "graphql" in the shape of graphql.persisted(hash, document).',
            start: o,
            length: l
          };
        }
        var {node: d, filename: v} = getDocumentReferenceFromDocumentNode(i.arguments[1], t, r);
        s = d;
        u = v;
        n = i.arguments[1].getText();
      }
      if (!s) {
        return {
          category: exports.ts.DiagnosticCategory.Warning,
          code: B,
          file: a,
          messageText: `Can't find reference to "${n}".`,
          start: o,
          length: l
        };
      }
      var g = s;
      if (!(g && exports.ts.isCallExpression(g) && g.arguments[0] && exports.ts.isStringLiteralLike(g.arguments[0]))) {
        return {
          category: exports.ts.DiagnosticCategory.Warning,
          code: B,
          file: a,
          messageText: `Referenced type "${n}" is not a GraphQL document.`,
          start: o,
          length: l
        };
      }
      if (!i.arguments[0]) {
        return {
          category: exports.ts.DiagnosticCategory.Warning,
          code: M,
          file: a,
          messageText: "The call-expression is missing a hash for the persisted argument.",
          start: i.arguments.pos,
          length: i.arguments.end - i.arguments.pos
        };
      }
      var m = i.arguments[0].getText().slice(1, -1);
      if (m.startsWith("sha256:")) {
        var x = generateHashForDocument(r, g.arguments[0], u, g.arguments[1] && exports.ts.isArrayLiteralExpression(g.arguments[1]) ? g.arguments[1] : void 0);
        if (!x) {
          return null;
        }
        if (`sha256:${x}` !== m) {
          return {
            category: exports.ts.DiagnosticCategory.Warning,
            code: $,
            file: a,
            messageText: "The persisted document's hash is outdated",
            start: i.arguments.pos,
            length: i.arguments.end - i.arguments.pos
          };
        }
      }
      return null;
    }).filter(Boolean);
    f.push(...g);
  }
  if (s && d) {
    var m = ((e, t) => {
      var i = findAllImports(e);
      var r = t.languageService.getProgram()?.getTypeChecker();
      var s = {};
      if (!r) {
        return s;
      }
      if (i.length) {
        i.forEach(e => {
          if (!e.importClause) {
            return;
          }
          if (e.importClause.name) {
            var i = getDeclarationOfIdentifier(e.importClause.name, r);
            if (i) {
              var a = i.getSourceFile();
              if (a.fileName.includes("node_modules")) {
                return;
              }
              if (!a) {
                return;
              }
              var n = getFragmentsInSource(a, r, t).map(e => e.name.value);
              var o = e.moduleSpecifier.getText();
              var l = s[o];
              if (n.length && l) {
                l.fragments = l.fragments.concat(n);
              } else if (n.length && !l) {
                s[o] = l = {
                  start: e.moduleSpecifier.getStart(),
                  length: e.moduleSpecifier.getText().length,
                  fragments: n
                };
              }
            }
          }
          if (e.importClause.namedBindings && exports.ts.isNamespaceImport(e.importClause.namedBindings)) {
            var u = getDeclarationOfIdentifier(e.importClause.namedBindings.name, r);
            if (u) {
              var c = u.getSourceFile();
              if (c.fileName.includes("node_modules")) {
                return;
              }
              if (!c) {
                return;
              }
              var f = getFragmentsInSource(c, r, t).map(e => e.name.value);
              var h = e.moduleSpecifier.getText();
              var d = s[h];
              if (f.length && d) {
                d.fragments = d.fragments.concat(f);
              } else if (f.length && !d) {
                s[h] = d = {
                  start: e.moduleSpecifier.getStart(),
                  length: e.moduleSpecifier.getText().length,
                  fragments: f
                };
              }
            }
          } else if (e.importClause.namedBindings && exports.ts.isNamedImportBindings(e.importClause.namedBindings)) {
            e.importClause.namedBindings.elements.forEach(i => {
              var a = i.name || i.propertyName;
              if (!a) {
                return;
              }
              var n = getDeclarationOfIdentifier(a, r);
              if (n) {
                var o = n.getSourceFile();
                if (o.fileName.includes("node_modules")) {
                  return;
                }
                if (!o) {
                  return;
                }
                var l = getFragmentsInSource(o, r, t).map(e => e.name.value);
                var u = e.moduleSpecifier.getText();
                var c = s[u];
                if (l.length && c) {
                  c.fragments = c.fragments.concat(l);
                } else if (l.length && !c) {
                  s[u] = c = {
                    start: e.moduleSpecifier.getStart(),
                    length: e.moduleSpecifier.getText().length,
                    fragments: l
                  };
                }
              }
            });
          }
        });
      }
      return s;
    })(a, r);
    var x = r.languageService.getProgram()?.getTypeChecker();
    var S = new Set;
    n.forEach(({node: t}) => {
      try {
        var i = e.parse(t.getText().slice(1, -1), {
          noLocation: !0
        });
        e.visit(i, {
          FragmentSpread: e => {
            S.add(e.name.value);
          }
        });
      } catch (e) {}
    });
    var y = function getDirectlyUsedFragments(t, i, r) {
      var s = new Set;
      if (!r) {
        return s;
      }
      var a = new Set;
      i.forEach(({tadaFragmentRefs: e}) => {
        if (e) {
          e.forEach(e => a.add(e));
        }
      });
      var n = new Map;
      var visit = e => {
        if (exports.ts.isIdentifier(e)) {
          var t = r.getSymbolAtLocation(e);
          if (t) {
            var i = n.get(t);
            if (i) {
              i.push(e);
            } else {
              n.set(t, [ e ]);
            }
          }
        }
        exports.ts.forEachChild(e, visit);
      };
      visit(t);
      var o = [];
      findAllImports(t).forEach(e => {
        var t = e.importClause;
        if (!t) {
          return;
        }
        if (t.name) {
          o.push(t.name);
        }
        var i = t.namedBindings;
        if (i) {
          if (exports.ts.isNamespaceImport(i)) {
            o.push(i.name);
          } else {
            i.elements.forEach(e => o.push(e.name));
          }
        }
      });
      o.forEach(t => {
        var i = r.getSymbolAtLocation(t);
        if (!i) {
          return;
        }
        if (!(n.get(i) || []).some(e => e !== t && !a.has(e))) {
          return;
        }
        (function getFragmentNamesForIdentifier(t, i) {
          var r = getValueOfIdentifier(t, i);
          if (!r || !exports.ts.isCallExpression(r)) {
            return [];
          }
          var s = r.arguments[0];
          if (!s || !exports.ts.isStringLiteralLike(s)) {
            return [];
          }
          try {
            return e.parse(s.getText().slice(1, -1), {
              noLocation: !0
            }).definitions.filter(t => t.kind === e.Kind.FRAGMENT_DEFINITION).map(e => e.name.value);
          } catch (e) {
            return [];
          }
        })(t, r).forEach(e => s.add(e));
      });
      return s;
    }(a, n, x);
    Object.keys(m).forEach(e => {
      var {fragments: t, start: i, length: r} = m[e];
      var s = Array.from(new Set(t.filter(e => !S.has(e) && !y.has(e))));
      if (s.length) {
        v.push({
          file: a,
          length: r,
          start: i,
          category: exports.ts.DiagnosticCategory.Warning,
          code: 52003,
          messageText: `Unused co-located fragment definition(s) "${s.join(", ")}" in ${e}`
        });
      }
    });
    return [ ...f, ...v ];
  } else {
    return f;
  }
};

exports.getPersistedCodeFixAtPosition = function getPersistedCodeFixAtPosition(e, t, i) {
  var r = i.config.templateIsCallExpression ?? !0;
  var s = i.languageService.getProgram()?.getTypeChecker();
  if (!r) {
    return;
  }
  var a = getSource(i, e);
  if (!a) {
    return;
  }
  var n = findNode(a, t);
  if (!n) {
    return;
  }
  var o = n;
  if (exports.ts.isVariableStatement(o)) {
    o = o.declarationList.declarations.find(e => exports.ts.isVariableDeclaration(e) && e.initializer && exports.ts.isCallExpression(e.initializer)) || n;
  } else if (exports.ts.isVariableDeclarationList(o)) {
    o = o.declarations.find(e => exports.ts.isVariableDeclaration(e) && e.initializer && exports.ts.isCallExpression(e.initializer)) || n;
  } else if (exports.ts.isVariableDeclaration(o) && o.initializer && exports.ts.isCallExpression(o.initializer)) {
    o = o.initializer;
  } else {
    while (o && !exports.ts.isCallExpression(o)) {
      o = o.parent;
    }
  }
  if (!isTadaPersistedCall(o, s)) {
    return;
  }
  var l, u = e;
  if (o.typeArguments) {
    var [c] = o.typeArguments;
    if (!c || !exports.ts.isTypeQueryNode(c)) {
      return;
    }
    var {node: f, filename: h} = getDocumentReferenceFromTypeQuery(c, e, i);
    l = f;
    u = h;
  } else if (o.arguments[1]) {
    if (!exports.ts.isIdentifier(o.arguments[1]) && !exports.ts.isCallExpression(o.arguments[1])) {
      return;
    }
    var {node: d, filename: v} = getDocumentReferenceFromDocumentNode(o.arguments[1], e, i);
    l = d;
    u = v;
  }
  if (!l) {
    return;
  }
  var g = l;
  if (!(g && exports.ts.isCallExpression(g) && g.arguments[0] && exports.ts.isStringLiteralLike(g.arguments[0]))) {
    return;
  }
  var m = generateHashForDocument(i, g.arguments[0], u, g.arguments[1] && exports.ts.isArrayLiteralExpression(g.arguments[1]) ? g.arguments[1] : void 0);
  var x = o.arguments[0];
  if (!x) {
    return {
      span: {
        start: o.arguments.pos,
        length: 1
      },
      replacement: `"sha256:${m}")`
    };
  } else if (exports.ts.isStringLiteral(x) && x.getText() !== `"sha256:${m}"`) {
    return {
      span: {
        start: x.getStart(),
        length: x.end - x.getStart()
      },
      replacement: `"sha256:${m}"`
    };
  } else if (exports.ts.isIdentifier(x)) {
    return {
      span: {
        start: x.getStart(),
        length: x.end - x.getStart()
      },
      replacement: `"sha256:${m}"`
    };
  } else {
    return;
  }
};

exports.getSchemaName = getSchemaName;

exports.getSource = getSource;

exports.init = function init(e) {
  exports.ts = e.typescript;
};

exports.isGraphQLCall = isGraphQLCall;

exports.isGraphQLTag = isGraphQLTag;

exports.onlineParser = onlineParser;

exports.print = print;

exports.resolveTemplate = resolveTemplate;

exports.templates = T;

exports.unrollTadaFragments = unrollTadaFragments;
//# sourceMappingURL=api-chunk.js.map
