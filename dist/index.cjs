var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// node_modules/@vue/shared/dist/shared.cjs.js
var require_shared_cjs = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  /*! #__NO_SIDE_EFFECTS__ */
  function makeMap(str) {
    const map = /* @__PURE__ */ Object.create(null);
    for (const key of str.split(","))
      map[key] = 1;
    return (val) => (val in map);
  }
  var EMPTY_OBJ = Object.freeze({});
  var EMPTY_ARR = Object.freeze([]);
  var NOOP = () => {};
  var NO = () => false;
  var isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
  var isModelListener = (key) => key.startsWith("onUpdate:");
  var extend = Object.assign;
  var remove = (arr, el) => {
    const i = arr.indexOf(el);
    if (i > -1) {
      arr.splice(i, 1);
    }
  };
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var hasOwn2 = (val, key) => hasOwnProperty.call(val, key);
  var isArray = Array.isArray;
  var isMap = (val) => toTypeString(val) === "[object Map]";
  var isSet = (val) => toTypeString(val) === "[object Set]";
  var isDate = (val) => toTypeString(val) === "[object Date]";
  var isRegExp = (val) => toTypeString(val) === "[object RegExp]";
  var isFunction = (val) => typeof val === "function";
  var isString = (val) => typeof val === "string";
  var isSymbol = (val) => typeof val === "symbol";
  var isObject7 = (val) => val !== null && typeof val === "object";
  var isPromise = (val) => {
    return (isObject7(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
  };
  var objectToString = Object.prototype.toString;
  var toTypeString = (value) => objectToString.call(value);
  var toRawType = (value) => {
    return toTypeString(value).slice(8, -1);
  };
  var isPlainObject = (val) => toTypeString(val) === "[object Object]";
  var isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
  var isReservedProp = /* @__PURE__ */ makeMap(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted");
  var isBuiltInDirective = /* @__PURE__ */ makeMap("bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo");
  var cacheStringFunction = (fn) => {
    const cache = /* @__PURE__ */ Object.create(null);
    return (str) => {
      const hit = cache[str];
      return hit || (cache[str] = fn(str));
    };
  };
  var camelizeRE = /-(\w)/g;
  var camelize = cacheStringFunction((str) => {
    return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : "");
  });
  var hyphenateRE = /\B([A-Z])/g;
  var hyphenate = cacheStringFunction((str) => str.replace(hyphenateRE, "-$1").toLowerCase());
  var capitalize = cacheStringFunction((str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  var toHandlerKey = cacheStringFunction((str) => {
    const s = str ? `on${capitalize(str)}` : ``;
    return s;
  });
  var hasChanged = (value, oldValue) => !Object.is(value, oldValue);
  var invokeArrayFns = (fns, ...arg) => {
    for (let i = 0;i < fns.length; i++) {
      fns[i](...arg);
    }
  };
  var def = (obj, key, value, writable = false) => {
    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: false,
      writable,
      value
    });
  };
  var looseToNumber = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
  };
  var toNumber = (val) => {
    const n = isString(val) ? Number(val) : NaN;
    return isNaN(n) ? val : n;
  };
  var _globalThis;
  var getGlobalThis = () => {
    return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
  };
  var identRE = /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/;
  function genPropsAccessExp(name) {
    return identRE.test(name) ? `__props.${name}` : `__props[${JSON.stringify(name)}]`;
  }
  function genCacheKey(source, options) {
    return source + JSON.stringify(options, (_, val) => typeof val === "function" ? val.toString() : val);
  }
  var PatchFlags = {
    TEXT: 1,
    "1": "TEXT",
    CLASS: 2,
    "2": "CLASS",
    STYLE: 4,
    "4": "STYLE",
    PROPS: 8,
    "8": "PROPS",
    FULL_PROPS: 16,
    "16": "FULL_PROPS",
    NEED_HYDRATION: 32,
    "32": "NEED_HYDRATION",
    STABLE_FRAGMENT: 64,
    "64": "STABLE_FRAGMENT",
    KEYED_FRAGMENT: 128,
    "128": "KEYED_FRAGMENT",
    UNKEYED_FRAGMENT: 256,
    "256": "UNKEYED_FRAGMENT",
    NEED_PATCH: 512,
    "512": "NEED_PATCH",
    DYNAMIC_SLOTS: 1024,
    "1024": "DYNAMIC_SLOTS",
    DEV_ROOT_FRAGMENT: 2048,
    "2048": "DEV_ROOT_FRAGMENT",
    CACHED: -1,
    "-1": "CACHED",
    BAIL: -2,
    "-2": "BAIL"
  };
  var PatchFlagNames = {
    [1]: `TEXT`,
    [2]: `CLASS`,
    [4]: `STYLE`,
    [8]: `PROPS`,
    [16]: `FULL_PROPS`,
    [32]: `NEED_HYDRATION`,
    [64]: `STABLE_FRAGMENT`,
    [128]: `KEYED_FRAGMENT`,
    [256]: `UNKEYED_FRAGMENT`,
    [512]: `NEED_PATCH`,
    [1024]: `DYNAMIC_SLOTS`,
    [2048]: `DEV_ROOT_FRAGMENT`,
    [-1]: `HOISTED`,
    [-2]: `BAIL`
  };
  var ShapeFlags = {
    ELEMENT: 1,
    "1": "ELEMENT",
    FUNCTIONAL_COMPONENT: 2,
    "2": "FUNCTIONAL_COMPONENT",
    STATEFUL_COMPONENT: 4,
    "4": "STATEFUL_COMPONENT",
    TEXT_CHILDREN: 8,
    "8": "TEXT_CHILDREN",
    ARRAY_CHILDREN: 16,
    "16": "ARRAY_CHILDREN",
    SLOTS_CHILDREN: 32,
    "32": "SLOTS_CHILDREN",
    TELEPORT: 64,
    "64": "TELEPORT",
    SUSPENSE: 128,
    "128": "SUSPENSE",
    COMPONENT_SHOULD_KEEP_ALIVE: 256,
    "256": "COMPONENT_SHOULD_KEEP_ALIVE",
    COMPONENT_KEPT_ALIVE: 512,
    "512": "COMPONENT_KEPT_ALIVE",
    COMPONENT: 6,
    "6": "COMPONENT"
  };
  var SlotFlags = {
    STABLE: 1,
    "1": "STABLE",
    DYNAMIC: 2,
    "2": "DYNAMIC",
    FORWARDED: 3,
    "3": "FORWARDED"
  };
  var slotFlagsText = {
    [1]: "STABLE",
    [2]: "DYNAMIC",
    [3]: "FORWARDED"
  };
  var GLOBALS_ALLOWED = "Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol";
  var isGloballyAllowed = /* @__PURE__ */ makeMap(GLOBALS_ALLOWED);
  var isGloballyWhitelisted = isGloballyAllowed;
  var range = 2;
  function generateCodeFrame(source, start = 0, end = source.length) {
    start = Math.max(0, Math.min(start, source.length));
    end = Math.max(0, Math.min(end, source.length));
    if (start > end)
      return "";
    let lines = source.split(/(\r?\n)/);
    const newlineSequences = lines.filter((_, idx) => idx % 2 === 1);
    lines = lines.filter((_, idx) => idx % 2 === 0);
    let count = 0;
    const res = [];
    for (let i = 0;i < lines.length; i++) {
      count += lines[i].length + (newlineSequences[i] && newlineSequences[i].length || 0);
      if (count >= start) {
        for (let j = i - range;j <= i + range || end > count; j++) {
          if (j < 0 || j >= lines.length)
            continue;
          const line = j + 1;
          res.push(`${line}${" ".repeat(Math.max(3 - String(line).length, 0))}|  ${lines[j]}`);
          const lineLength = lines[j].length;
          const newLineSeqLength = newlineSequences[j] && newlineSequences[j].length || 0;
          if (j === i) {
            const pad = start - (count - (lineLength + newLineSeqLength));
            const length = Math.max(1, end > count ? lineLength - pad : end - start);
            res.push(`   |  ` + " ".repeat(pad) + "^".repeat(length));
          } else if (j > i) {
            if (end > count) {
              const length = Math.max(Math.min(end - count, lineLength), 1);
              res.push(`   |  ` + "^".repeat(length));
            }
            count += lineLength + newLineSeqLength;
          }
        }
        break;
      }
    }
    return res.join(`
`);
  }
  function normalizeStyle(value) {
    if (isArray(value)) {
      const res = {};
      for (let i = 0;i < value.length; i++) {
        const item = value[i];
        const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
        if (normalized) {
          for (const key in normalized) {
            res[key] = normalized[key];
          }
        }
      }
      return res;
    } else if (isString(value) || isObject7(value)) {
      return value;
    }
  }
  var listDelimiterRE = /;(?![^(]*\))/g;
  var propertyDelimiterRE = /:([^]+)/;
  var styleCommentRE = /\/\*[^]*?\*\//g;
  function parseStringStyle(cssText) {
    const ret = {};
    cssText.replace(styleCommentRE, "").split(listDelimiterRE).forEach((item) => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE);
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
      }
    });
    return ret;
  }
  function stringifyStyle(styles) {
    if (!styles)
      return "";
    if (isString(styles))
      return styles;
    let ret = "";
    for (const key in styles) {
      const value = styles[key];
      if (isString(value) || typeof value === "number") {
        const normalizedKey = key.startsWith(`--`) ? key : hyphenate(key);
        ret += `${normalizedKey}:${value};`;
      }
    }
    return ret;
  }
  function normalizeClass(value) {
    let res = "";
    if (isString(value)) {
      res = value;
    } else if (isArray(value)) {
      for (let i = 0;i < value.length; i++) {
        const normalized = normalizeClass(value[i]);
        if (normalized) {
          res += normalized + " ";
        }
      }
    } else if (isObject7(value)) {
      for (const name in value) {
        if (value[name]) {
          res += name + " ";
        }
      }
    }
    return res.trim();
  }
  function normalizeProps(props) {
    if (!props)
      return null;
    let { class: klass, style } = props;
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass);
    }
    if (style) {
      props.style = normalizeStyle(style);
    }
    return props;
  }
  var HTML_TAGS = "html,body,base,head,link,meta,style,title,address,article,aside,footer,header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,summary,template,blockquote,iframe,tfoot";
  var SVG_TAGS = "svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,textPath,title,tspan,unknown,use,view";
  var MATH_TAGS = "annotation,annotation-xml,maction,maligngroup,malignmark,math,menclose,merror,mfenced,mfrac,mfraction,mglyph,mi,mlabeledtr,mlongdiv,mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,mscarries,mscarry,msgroup,msline,mspace,msqrt,msrow,mstack,mstyle,msub,msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,none,semantics";
  var VOID_TAGS = "area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr";
  var isHTMLTag = /* @__PURE__ */ makeMap(HTML_TAGS);
  var isSVGTag = /* @__PURE__ */ makeMap(SVG_TAGS);
  var isMathMLTag = /* @__PURE__ */ makeMap(MATH_TAGS);
  var isVoidTag = /* @__PURE__ */ makeMap(VOID_TAGS);
  var specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
  var isSpecialBooleanAttr = /* @__PURE__ */ makeMap(specialBooleanAttrs);
  var isBooleanAttr = /* @__PURE__ */ makeMap(specialBooleanAttrs + `,async,autofocus,autoplay,controls,default,defer,disabled,hidden,inert,loop,open,required,reversed,scoped,seamless,checked,muted,multiple,selected`);
  function includeBooleanAttr(value) {
    return !!value || value === "";
  }
  var unsafeAttrCharRE = /[>/="'\u0009\u000a\u000c\u0020]/;
  var attrValidationCache = {};
  function isSSRSafeAttrName(name) {
    if (attrValidationCache.hasOwnProperty(name)) {
      return attrValidationCache[name];
    }
    const isUnsafe = unsafeAttrCharRE.test(name);
    if (isUnsafe) {
      console.error(`unsafe attribute name: ${name}`);
    }
    return attrValidationCache[name] = !isUnsafe;
  }
  var propsToAttrMap = {
    acceptCharset: "accept-charset",
    className: "class",
    htmlFor: "for",
    httpEquiv: "http-equiv"
  };
  var isKnownHtmlAttr = /* @__PURE__ */ makeMap(`accept,accept-charset,accesskey,action,align,allow,alt,async,autocapitalize,autocomplete,autofocus,autoplay,background,bgcolor,border,buffered,capture,challenge,charset,checked,cite,class,code,codebase,color,cols,colspan,content,contenteditable,contextmenu,controls,coords,crossorigin,csp,data,datetime,decoding,default,defer,dir,dirname,disabled,download,draggable,dropzone,enctype,enterkeyhint,for,form,formaction,formenctype,formmethod,formnovalidate,formtarget,headers,height,hidden,high,href,hreflang,http-equiv,icon,id,importance,inert,integrity,ismap,itemprop,keytype,kind,label,lang,language,loading,list,loop,low,manifest,max,maxlength,minlength,media,min,multiple,muted,name,novalidate,open,optimum,pattern,ping,placeholder,poster,preload,radiogroup,readonly,referrerpolicy,rel,required,reversed,rows,rowspan,sandbox,scope,scoped,selected,shape,size,sizes,slot,span,spellcheck,src,srcdoc,srclang,srcset,start,step,style,summary,tabindex,target,title,translate,type,usemap,value,width,wrap`);
  var isKnownSvgAttr = /* @__PURE__ */ makeMap(`xmlns,accent-height,accumulate,additive,alignment-baseline,alphabetic,amplitude,arabic-form,ascent,attributeName,attributeType,azimuth,baseFrequency,baseline-shift,baseProfile,bbox,begin,bias,by,calcMode,cap-height,class,clip,clipPathUnits,clip-path,clip-rule,color,color-interpolation,color-interpolation-filters,color-profile,color-rendering,contentScriptType,contentStyleType,crossorigin,cursor,cx,cy,d,decelerate,descent,diffuseConstant,direction,display,divisor,dominant-baseline,dur,dx,dy,edgeMode,elevation,enable-background,end,exponent,fill,fill-opacity,fill-rule,filter,filterRes,filterUnits,flood-color,flood-opacity,font-family,font-size,font-size-adjust,font-stretch,font-style,font-variant,font-weight,format,from,fr,fx,fy,g1,g2,glyph-name,glyph-orientation-horizontal,glyph-orientation-vertical,glyphRef,gradientTransform,gradientUnits,hanging,height,href,hreflang,horiz-adv-x,horiz-origin-x,id,ideographic,image-rendering,in,in2,intercept,k,k1,k2,k3,k4,kernelMatrix,kernelUnitLength,kerning,keyPoints,keySplines,keyTimes,lang,lengthAdjust,letter-spacing,lighting-color,limitingConeAngle,local,marker-end,marker-mid,marker-start,markerHeight,markerUnits,markerWidth,mask,maskContentUnits,maskUnits,mathematical,max,media,method,min,mode,name,numOctaves,offset,opacity,operator,order,orient,orientation,origin,overflow,overline-position,overline-thickness,panose-1,paint-order,path,pathLength,patternContentUnits,patternTransform,patternUnits,ping,pointer-events,points,pointsAtX,pointsAtY,pointsAtZ,preserveAlpha,preserveAspectRatio,primitiveUnits,r,radius,referrerPolicy,refX,refY,rel,rendering-intent,repeatCount,repeatDur,requiredExtensions,requiredFeatures,restart,result,rotate,rx,ry,scale,seed,shape-rendering,slope,spacing,specularConstant,specularExponent,speed,spreadMethod,startOffset,stdDeviation,stemh,stemv,stitchTiles,stop-color,stop-opacity,strikethrough-position,strikethrough-thickness,string,stroke,stroke-dasharray,stroke-dashoffset,stroke-linecap,stroke-linejoin,stroke-miterlimit,stroke-opacity,stroke-width,style,surfaceScale,systemLanguage,tabindex,tableValues,target,targetX,targetY,text-anchor,text-decoration,text-rendering,textLength,to,transform,transform-origin,type,u1,u2,underline-position,underline-thickness,unicode,unicode-bidi,unicode-range,units-per-em,v-alphabetic,v-hanging,v-ideographic,v-mathematical,values,vector-effect,version,vert-adv-y,vert-origin-x,vert-origin-y,viewBox,viewTarget,visibility,width,widths,word-spacing,writing-mode,x,x-height,x1,x2,xChannelSelector,xlink:actuate,xlink:arcrole,xlink:href,xlink:role,xlink:show,xlink:title,xlink:type,xmlns:xlink,xml:base,xml:lang,xml:space,y,y1,y2,yChannelSelector,z,zoomAndPan`);
  var isKnownMathMLAttr = /* @__PURE__ */ makeMap(`accent,accentunder,actiontype,align,alignmentscope,altimg,altimg-height,altimg-valign,altimg-width,alttext,bevelled,close,columnsalign,columnlines,columnspan,denomalign,depth,dir,display,displaystyle,encoding,equalcolumns,equalrows,fence,fontstyle,fontweight,form,frame,framespacing,groupalign,height,href,id,indentalign,indentalignfirst,indentalignlast,indentshift,indentshiftfirst,indentshiftlast,indextype,justify,largetop,largeop,lquote,lspace,mathbackground,mathcolor,mathsize,mathvariant,maxsize,minlabelspacing,mode,other,overflow,position,rowalign,rowlines,rowspan,rquote,rspace,scriptlevel,scriptminsize,scriptsizemultiplier,selection,separator,separators,shift,side,src,stackalign,stretchy,subscriptshift,superscriptshift,symmetric,voffset,width,widths,xlink:href,xlink:show,xlink:type,xmlns`);
  function isRenderableAttrValue(value) {
    if (value == null) {
      return false;
    }
    const type = typeof value;
    return type === "string" || type === "number" || type === "boolean";
  }
  var escapeRE = /["'&<>]/;
  function escapeHtml(string) {
    const str = "" + string;
    const match = escapeRE.exec(str);
    if (!match) {
      return str;
    }
    let html = "";
    let escaped;
    let index;
    let lastIndex = 0;
    for (index = match.index;index < str.length; index++) {
      switch (str.charCodeAt(index)) {
        case 34:
          escaped = "&quot;";
          break;
        case 38:
          escaped = "&amp;";
          break;
        case 39:
          escaped = "&#39;";
          break;
        case 60:
          escaped = "&lt;";
          break;
        case 62:
          escaped = "&gt;";
          break;
        default:
          continue;
      }
      if (lastIndex !== index) {
        html += str.slice(lastIndex, index);
      }
      lastIndex = index + 1;
      html += escaped;
    }
    return lastIndex !== index ? html + str.slice(lastIndex, index) : html;
  }
  var commentStripRE = /^-?>|<!--|-->|--!>|<!-$/g;
  function escapeHtmlComment(src) {
    return src.replace(commentStripRE, "");
  }
  var cssVarNameEscapeSymbolsRE = /[ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g;
  function getEscapedCssVarName(key, doubleEscape) {
    return key.replace(cssVarNameEscapeSymbolsRE, (s) => doubleEscape ? s === '"' ? "\\\\\\\"" : `\\\\${s}` : `\\${s}`);
  }
  function looseCompareArrays(a, b) {
    if (a.length !== b.length)
      return false;
    let equal = true;
    for (let i = 0;equal && i < a.length; i++) {
      equal = looseEqual(a[i], b[i]);
    }
    return equal;
  }
  function looseEqual(a, b) {
    if (a === b)
      return true;
    let aValidType = isDate(a);
    let bValidType = isDate(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? a.getTime() === b.getTime() : false;
    }
    aValidType = isSymbol(a);
    bValidType = isSymbol(b);
    if (aValidType || bValidType) {
      return a === b;
    }
    aValidType = isArray(a);
    bValidType = isArray(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareArrays(a, b) : false;
    }
    aValidType = isObject7(a);
    bValidType = isObject7(b);
    if (aValidType || bValidType) {
      if (!aValidType || !bValidType) {
        return false;
      }
      const aKeysCount = Object.keys(a).length;
      const bKeysCount = Object.keys(b).length;
      if (aKeysCount !== bKeysCount) {
        return false;
      }
      for (const key in a) {
        const aHasKey = a.hasOwnProperty(key);
        const bHasKey = b.hasOwnProperty(key);
        if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key])) {
          return false;
        }
      }
    }
    return String(a) === String(b);
  }
  function looseIndexOf(arr, val) {
    return arr.findIndex((item) => looseEqual(item, val));
  }
  var isRef3 = (val) => {
    return !!(val && val["__v_isRef"] === true);
  };
  var toDisplayString = (val) => {
    return isString(val) ? val : val == null ? "" : isArray(val) || isObject7(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef3(val) ? toDisplayString(val.value) : JSON.stringify(val, replacer, 2) : String(val);
  };
  var replacer = (_key, val) => {
    if (isRef3(val)) {
      return replacer(_key, val.value);
    } else if (isMap(val)) {
      return {
        [`Map(${val.size})`]: [...val.entries()].reduce((entries, [key, val2], i) => {
          entries[stringifySymbol(key, i) + " =>"] = val2;
          return entries;
        }, {})
      };
    } else if (isSet(val)) {
      return {
        [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v))
      };
    } else if (isSymbol(val)) {
      return stringifySymbol(val);
    } else if (isObject7(val) && !isArray(val) && !isPlainObject(val)) {
      return String(val);
    }
    return val;
  };
  var stringifySymbol = (v, i = "") => {
    var _a;
    return isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v;
  };
  exports2.EMPTY_ARR = EMPTY_ARR;
  exports2.EMPTY_OBJ = EMPTY_OBJ;
  exports2.NO = NO;
  exports2.NOOP = NOOP;
  exports2.PatchFlagNames = PatchFlagNames;
  exports2.PatchFlags = PatchFlags;
  exports2.ShapeFlags = ShapeFlags;
  exports2.SlotFlags = SlotFlags;
  exports2.camelize = camelize;
  exports2.capitalize = capitalize;
  exports2.cssVarNameEscapeSymbolsRE = cssVarNameEscapeSymbolsRE;
  exports2.def = def;
  exports2.escapeHtml = escapeHtml;
  exports2.escapeHtmlComment = escapeHtmlComment;
  exports2.extend = extend;
  exports2.genCacheKey = genCacheKey;
  exports2.genPropsAccessExp = genPropsAccessExp;
  exports2.generateCodeFrame = generateCodeFrame;
  exports2.getEscapedCssVarName = getEscapedCssVarName;
  exports2.getGlobalThis = getGlobalThis;
  exports2.hasChanged = hasChanged;
  exports2.hasOwn = hasOwn2;
  exports2.hyphenate = hyphenate;
  exports2.includeBooleanAttr = includeBooleanAttr;
  exports2.invokeArrayFns = invokeArrayFns;
  exports2.isArray = isArray;
  exports2.isBooleanAttr = isBooleanAttr;
  exports2.isBuiltInDirective = isBuiltInDirective;
  exports2.isDate = isDate;
  exports2.isFunction = isFunction;
  exports2.isGloballyAllowed = isGloballyAllowed;
  exports2.isGloballyWhitelisted = isGloballyWhitelisted;
  exports2.isHTMLTag = isHTMLTag;
  exports2.isIntegerKey = isIntegerKey;
  exports2.isKnownHtmlAttr = isKnownHtmlAttr;
  exports2.isKnownMathMLAttr = isKnownMathMLAttr;
  exports2.isKnownSvgAttr = isKnownSvgAttr;
  exports2.isMap = isMap;
  exports2.isMathMLTag = isMathMLTag;
  exports2.isModelListener = isModelListener;
  exports2.isObject = isObject7;
  exports2.isOn = isOn;
  exports2.isPlainObject = isPlainObject;
  exports2.isPromise = isPromise;
  exports2.isRegExp = isRegExp;
  exports2.isRenderableAttrValue = isRenderableAttrValue;
  exports2.isReservedProp = isReservedProp;
  exports2.isSSRSafeAttrName = isSSRSafeAttrName;
  exports2.isSVGTag = isSVGTag;
  exports2.isSet = isSet;
  exports2.isSpecialBooleanAttr = isSpecialBooleanAttr;
  exports2.isString = isString;
  exports2.isSymbol = isSymbol;
  exports2.isVoidTag = isVoidTag;
  exports2.looseEqual = looseEqual;
  exports2.looseIndexOf = looseIndexOf;
  exports2.looseToNumber = looseToNumber;
  exports2.makeMap = makeMap;
  exports2.normalizeClass = normalizeClass;
  exports2.normalizeProps = normalizeProps;
  exports2.normalizeStyle = normalizeStyle;
  exports2.objectToString = objectToString;
  exports2.parseStringStyle = parseStringStyle;
  exports2.propsToAttrMap = propsToAttrMap;
  exports2.remove = remove;
  exports2.slotFlagsText = slotFlagsText;
  exports2.stringifyStyle = stringifyStyle;
  exports2.toDisplayString = toDisplayString;
  exports2.toHandlerKey = toHandlerKey;
  exports2.toNumber = toNumber;
  exports2.toRawType = toRawType;
  exports2.toTypeString = toTypeString;
});

// node_modules/@vue/reactivity/dist/reactivity.cjs.js
var require_reactivity_cjs = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  var shared = require_shared_cjs();
  function warn(msg, ...args) {
    console.warn(`[Vue warn] ${msg}`, ...args);
  }
  var activeEffectScope;

  class EffectScope {
    constructor(detached = false) {
      this.detached = detached;
      this._active = true;
      this.effects = [];
      this.cleanups = [];
      this._isPaused = false;
      this.parent = activeEffectScope;
      if (!detached && activeEffectScope) {
        this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(this) - 1;
      }
    }
    get active() {
      return this._active;
    }
    pause() {
      if (this._active) {
        this._isPaused = true;
        let i, l;
        if (this.scopes) {
          for (i = 0, l = this.scopes.length;i < l; i++) {
            this.scopes[i].pause();
          }
        }
        for (i = 0, l = this.effects.length;i < l; i++) {
          this.effects[i].pause();
        }
      }
    }
    resume() {
      if (this._active) {
        if (this._isPaused) {
          this._isPaused = false;
          let i, l;
          if (this.scopes) {
            for (i = 0, l = this.scopes.length;i < l; i++) {
              this.scopes[i].resume();
            }
          }
          for (i = 0, l = this.effects.length;i < l; i++) {
            this.effects[i].resume();
          }
        }
      }
    }
    run(fn) {
      if (this._active) {
        const currentEffectScope = activeEffectScope;
        try {
          activeEffectScope = this;
          return fn();
        } finally {
          activeEffectScope = currentEffectScope;
        }
      } else {
        warn(`cannot run an inactive effect scope.`);
      }
    }
    on() {
      activeEffectScope = this;
    }
    off() {
      activeEffectScope = this.parent;
    }
    stop(fromParent) {
      if (this._active) {
        this._active = false;
        let i, l;
        for (i = 0, l = this.effects.length;i < l; i++) {
          this.effects[i].stop();
        }
        this.effects.length = 0;
        for (i = 0, l = this.cleanups.length;i < l; i++) {
          this.cleanups[i]();
        }
        this.cleanups.length = 0;
        if (this.scopes) {
          for (i = 0, l = this.scopes.length;i < l; i++) {
            this.scopes[i].stop(true);
          }
          this.scopes.length = 0;
        }
        if (!this.detached && this.parent && !fromParent) {
          const last = this.parent.scopes.pop();
          if (last && last !== this) {
            this.parent.scopes[this.index] = last;
            last.index = this.index;
          }
        }
        this.parent = undefined;
      }
    }
  }
  function effectScope(detached) {
    return new EffectScope(detached);
  }
  function getCurrentScope() {
    return activeEffectScope;
  }
  function onScopeDispose(fn, failSilently = false) {
    if (activeEffectScope) {
      activeEffectScope.cleanups.push(fn);
    } else if (!failSilently) {
      warn(`onScopeDispose() is called when there is no active effect scope to be associated with.`);
    }
  }
  var activeSub;
  var EffectFlags = {
    ACTIVE: 1,
    "1": "ACTIVE",
    RUNNING: 2,
    "2": "RUNNING",
    TRACKING: 4,
    "4": "TRACKING",
    NOTIFIED: 8,
    "8": "NOTIFIED",
    DIRTY: 16,
    "16": "DIRTY",
    ALLOW_RECURSE: 32,
    "32": "ALLOW_RECURSE",
    PAUSED: 64,
    "64": "PAUSED"
  };
  var pausedQueueEffects = /* @__PURE__ */ new WeakSet;

  class ReactiveEffect {
    constructor(fn) {
      this.fn = fn;
      this.deps = undefined;
      this.depsTail = undefined;
      this.flags = 1 | 4;
      this.next = undefined;
      this.cleanup = undefined;
      this.scheduler = undefined;
      if (activeEffectScope && activeEffectScope.active) {
        activeEffectScope.effects.push(this);
      }
    }
    pause() {
      this.flags |= 64;
    }
    resume() {
      if (this.flags & 64) {
        this.flags &= ~64;
        if (pausedQueueEffects.has(this)) {
          pausedQueueEffects.delete(this);
          this.trigger();
        }
      }
    }
    notify() {
      if (this.flags & 2 && !(this.flags & 32)) {
        return;
      }
      if (!(this.flags & 8)) {
        batch(this);
      }
    }
    run() {
      if (!(this.flags & 1)) {
        return this.fn();
      }
      this.flags |= 2;
      cleanupEffect3(this);
      prepareDeps(this);
      const prevEffect = activeSub;
      const prevShouldTrack = shouldTrack;
      activeSub = this;
      shouldTrack = true;
      try {
        return this.fn();
      } finally {
        if (activeSub !== this) {
          warn("Active effect was not restored correctly - this is likely a Vue internal bug.");
        }
        cleanupDeps(this);
        activeSub = prevEffect;
        shouldTrack = prevShouldTrack;
        this.flags &= ~2;
      }
    }
    stop() {
      if (this.flags & 1) {
        for (let link = this.deps;link; link = link.nextDep) {
          removeSub(link);
        }
        this.deps = this.depsTail = undefined;
        cleanupEffect3(this);
        this.onStop && this.onStop();
        this.flags &= ~1;
      }
    }
    trigger() {
      if (this.flags & 64) {
        pausedQueueEffects.add(this);
      } else if (this.scheduler) {
        this.scheduler();
      } else {
        this.runIfDirty();
      }
    }
    runIfDirty() {
      if (isDirty(this)) {
        this.run();
      }
    }
    get dirty() {
      return isDirty(this);
    }
  }
  var batchDepth = 0;
  var batchedSub;
  var batchedComputed;
  function batch(sub, isComputed2 = false) {
    sub.flags |= 8;
    if (isComputed2) {
      sub.next = batchedComputed;
      batchedComputed = sub;
      return;
    }
    sub.next = batchedSub;
    batchedSub = sub;
  }
  function startBatch() {
    batchDepth++;
  }
  function endBatch() {
    if (--batchDepth > 0) {
      return;
    }
    if (batchedComputed) {
      let e = batchedComputed;
      batchedComputed = undefined;
      while (e) {
        const next = e.next;
        e.next = undefined;
        e.flags &= ~8;
        e = next;
      }
    }
    let error;
    while (batchedSub) {
      let e = batchedSub;
      batchedSub = undefined;
      while (e) {
        const next = e.next;
        e.next = undefined;
        e.flags &= ~8;
        if (e.flags & 1) {
          try {
            e.trigger();
          } catch (err) {
            if (!error)
              error = err;
          }
        }
        e = next;
      }
    }
    if (error)
      throw error;
  }
  function prepareDeps(sub) {
    for (let link = sub.deps;link; link = link.nextDep) {
      link.version = -1;
      link.prevActiveLink = link.dep.activeLink;
      link.dep.activeLink = link;
    }
  }
  function cleanupDeps(sub) {
    let head;
    let tail = sub.depsTail;
    let link = tail;
    while (link) {
      const prev = link.prevDep;
      if (link.version === -1) {
        if (link === tail)
          tail = prev;
        removeSub(link);
        removeDep(link);
      } else {
        head = link;
      }
      link.dep.activeLink = link.prevActiveLink;
      link.prevActiveLink = undefined;
      link = prev;
    }
    sub.deps = head;
    sub.depsTail = tail;
  }
  function isDirty(sub) {
    for (let link = sub.deps;link; link = link.nextDep) {
      if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) {
        return true;
      }
    }
    if (sub._dirty) {
      return true;
    }
    return false;
  }
  function refreshComputed(computed3) {
    if (computed3.flags & 4 && !(computed3.flags & 16)) {
      return;
    }
    computed3.flags &= ~16;
    if (computed3.globalVersion === globalVersion) {
      return;
    }
    computed3.globalVersion = globalVersion;
    const dep = computed3.dep;
    computed3.flags |= 2;
    if (dep.version > 0 && !computed3.isSSR && computed3.deps && !isDirty(computed3)) {
      computed3.flags &= ~2;
      return;
    }
    const prevSub = activeSub;
    const prevShouldTrack = shouldTrack;
    activeSub = computed3;
    shouldTrack = true;
    try {
      prepareDeps(computed3);
      const value = computed3.fn(computed3._value);
      if (dep.version === 0 || shared.hasChanged(value, computed3._value)) {
        computed3._value = value;
        dep.version++;
      }
    } catch (err) {
      dep.version++;
      throw err;
    } finally {
      activeSub = prevSub;
      shouldTrack = prevShouldTrack;
      cleanupDeps(computed3);
      computed3.flags &= ~2;
    }
  }
  function removeSub(link, soft = false) {
    const { dep, prevSub, nextSub } = link;
    if (prevSub) {
      prevSub.nextSub = nextSub;
      link.prevSub = undefined;
    }
    if (nextSub) {
      nextSub.prevSub = prevSub;
      link.nextSub = undefined;
    }
    if (dep.subsHead === link) {
      dep.subsHead = nextSub;
    }
    if (dep.subs === link) {
      dep.subs = prevSub;
      if (!prevSub && dep.computed) {
        dep.computed.flags &= ~4;
        for (let l = dep.computed.deps;l; l = l.nextDep) {
          removeSub(l, true);
        }
      }
    }
    if (!soft && !--dep.sc && dep.map) {
      dep.map.delete(dep.key);
    }
  }
  function removeDep(link) {
    const { prevDep, nextDep } = link;
    if (prevDep) {
      prevDep.nextDep = nextDep;
      link.prevDep = undefined;
    }
    if (nextDep) {
      nextDep.prevDep = prevDep;
      link.nextDep = undefined;
    }
  }
  function effect(fn, options) {
    if (fn.effect instanceof ReactiveEffect) {
      fn = fn.effect.fn;
    }
    const e = new ReactiveEffect(fn);
    if (options) {
      shared.extend(e, options);
    }
    try {
      e.run();
    } catch (err) {
      e.stop();
      throw err;
    }
    const runner = e.run.bind(e);
    runner.effect = e;
    return runner;
  }
  function stop(runner) {
    runner.effect.stop();
  }
  var shouldTrack = true;
  var trackStack = [];
  function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
  }
  function enableTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = true;
  }
  function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === undefined ? true : last;
  }
  function onEffectCleanup(fn, failSilently = false) {
    if (activeSub instanceof ReactiveEffect) {
      activeSub.cleanup = fn;
    } else if (!failSilently) {
      warn(`onEffectCleanup() was called when there was no active effect to associate with.`);
    }
  }
  function cleanupEffect3(e) {
    const { cleanup } = e;
    e.cleanup = undefined;
    if (cleanup) {
      const prevSub = activeSub;
      activeSub = undefined;
      try {
        cleanup();
      } finally {
        activeSub = prevSub;
      }
    }
  }
  var globalVersion = 0;

  class Link {
    constructor(sub, dep) {
      this.sub = sub;
      this.dep = dep;
      this.version = dep.version;
      this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = undefined;
    }
  }

  class Dep {
    constructor(computed3) {
      this.computed = computed3;
      this.version = 0;
      this.activeLink = undefined;
      this.subs = undefined;
      this.map = undefined;
      this.key = undefined;
      this.sc = 0;
      {
        this.subsHead = undefined;
      }
    }
    track(debugInfo) {
      if (!activeSub || !shouldTrack || activeSub === this.computed) {
        return;
      }
      let link = this.activeLink;
      if (link === undefined || link.sub !== activeSub) {
        link = this.activeLink = new Link(activeSub, this);
        if (!activeSub.deps) {
          activeSub.deps = activeSub.depsTail = link;
        } else {
          link.prevDep = activeSub.depsTail;
          activeSub.depsTail.nextDep = link;
          activeSub.depsTail = link;
        }
        addSub(link);
      } else if (link.version === -1) {
        link.version = this.version;
        if (link.nextDep) {
          const next = link.nextDep;
          next.prevDep = link.prevDep;
          if (link.prevDep) {
            link.prevDep.nextDep = next;
          }
          link.prevDep = activeSub.depsTail;
          link.nextDep = undefined;
          activeSub.depsTail.nextDep = link;
          activeSub.depsTail = link;
          if (activeSub.deps === link) {
            activeSub.deps = next;
          }
        }
      }
      if (activeSub.onTrack) {
        activeSub.onTrack(shared.extend({
          effect: activeSub
        }, debugInfo));
      }
      return link;
    }
    trigger(debugInfo) {
      this.version++;
      globalVersion++;
      this.notify(debugInfo);
    }
    notify(debugInfo) {
      startBatch();
      try {
        if (true) {
          for (let head = this.subsHead;head; head = head.nextSub) {
            if (head.sub.onTrigger && !(head.sub.flags & 8)) {
              head.sub.onTrigger(shared.extend({
                effect: head.sub
              }, debugInfo));
            }
          }
        }
        for (let link = this.subs;link; link = link.prevSub) {
          if (link.sub.notify()) {
            link.sub.dep.notify();
          }
        }
      } finally {
        endBatch();
      }
    }
  }
  function addSub(link) {
    link.dep.sc++;
    if (link.sub.flags & 4) {
      const computed3 = link.dep.computed;
      if (computed3 && !link.dep.subs) {
        computed3.flags |= 4 | 16;
        for (let l = computed3.deps;l; l = l.nextDep) {
          addSub(l);
        }
      }
      const currentTail = link.dep.subs;
      if (currentTail !== link) {
        link.prevSub = currentTail;
        if (currentTail)
          currentTail.nextSub = link;
      }
      if (link.dep.subsHead === undefined) {
        link.dep.subsHead = link;
      }
      link.dep.subs = link;
    }
  }
  var targetMap2 = /* @__PURE__ */ new WeakMap;
  var ITERATE_KEY = Symbol("Object iterate");
  var MAP_KEY_ITERATE_KEY = Symbol("Map keys iterate");
  var ARRAY_ITERATE_KEY = Symbol("Array iterate");
  function track2(target, type, key) {
    if (shouldTrack && activeSub) {
      let depsMap = targetMap2.get(target);
      if (!depsMap) {
        targetMap2.set(target, depsMap = /* @__PURE__ */ new Map);
      }
      let dep = depsMap.get(key);
      if (!dep) {
        depsMap.set(key, dep = new Dep);
        dep.map = depsMap;
        dep.key = key;
      }
      {
        dep.track({
          target,
          type,
          key
        });
      }
    }
  }
  function trigger2(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap2.get(target);
    if (!depsMap) {
      globalVersion++;
      return;
    }
    const run = (dep) => {
      if (dep) {
        {
          dep.trigger({
            target,
            type,
            key,
            newValue,
            oldValue,
            oldTarget
          });
        }
      }
    };
    startBatch();
    if (type === "clear") {
      depsMap.forEach(run);
    } else {
      const targetIsArray = shared.isArray(target);
      const isArrayIndex = targetIsArray && shared.isIntegerKey(key);
      if (targetIsArray && key === "length") {
        const newLength = Number(newValue);
        depsMap.forEach((dep, key2) => {
          if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !shared.isSymbol(key2) && key2 >= newLength) {
            run(dep);
          }
        });
      } else {
        if (key !== undefined || depsMap.has(undefined)) {
          run(depsMap.get(key));
        }
        if (isArrayIndex) {
          run(depsMap.get(ARRAY_ITERATE_KEY));
        }
        switch (type) {
          case "add":
            if (!targetIsArray) {
              run(depsMap.get(ITERATE_KEY));
              if (shared.isMap(target)) {
                run(depsMap.get(MAP_KEY_ITERATE_KEY));
              }
            } else if (isArrayIndex) {
              run(depsMap.get("length"));
            }
            break;
          case "delete":
            if (!targetIsArray) {
              run(depsMap.get(ITERATE_KEY));
              if (shared.isMap(target)) {
                run(depsMap.get(MAP_KEY_ITERATE_KEY));
              }
            }
            break;
          case "set":
            if (shared.isMap(target)) {
              run(depsMap.get(ITERATE_KEY));
            }
            break;
        }
      }
    }
    endBatch();
  }
  function getDepFromReactive(object, key) {
    const depMap = targetMap2.get(object);
    return depMap && depMap.get(key);
  }
  function reactiveReadArray(array) {
    const raw = toRaw2(array);
    if (raw === array)
      return raw;
    track2(raw, "iterate", ARRAY_ITERATE_KEY);
    return isShallow(array) ? raw : raw.map(toReactive);
  }
  function shallowReadArray(arr) {
    track2(arr = toRaw2(arr), "iterate", ARRAY_ITERATE_KEY);
    return arr;
  }
  var arrayInstrumentations = {
    __proto__: null,
    [Symbol.iterator]() {
      return iterator(this, Symbol.iterator, toReactive);
    },
    concat(...args) {
      return reactiveReadArray(this).concat(...args.map((x) => shared.isArray(x) ? reactiveReadArray(x) : x));
    },
    entries() {
      return iterator(this, "entries", (value) => {
        value[1] = toReactive(value[1]);
        return value;
      });
    },
    every(fn, thisArg) {
      return apply(this, "every", fn, thisArg, undefined, arguments);
    },
    filter(fn, thisArg) {
      return apply(this, "filter", fn, thisArg, (v) => v.map(toReactive), arguments);
    },
    find(fn, thisArg) {
      return apply(this, "find", fn, thisArg, toReactive, arguments);
    },
    findIndex(fn, thisArg) {
      return apply(this, "findIndex", fn, thisArg, undefined, arguments);
    },
    findLast(fn, thisArg) {
      return apply(this, "findLast", fn, thisArg, toReactive, arguments);
    },
    findLastIndex(fn, thisArg) {
      return apply(this, "findLastIndex", fn, thisArg, undefined, arguments);
    },
    forEach(fn, thisArg) {
      return apply(this, "forEach", fn, thisArg, undefined, arguments);
    },
    includes(...args) {
      return searchProxy(this, "includes", args);
    },
    indexOf(...args) {
      return searchProxy(this, "indexOf", args);
    },
    join(separator) {
      return reactiveReadArray(this).join(separator);
    },
    lastIndexOf(...args) {
      return searchProxy(this, "lastIndexOf", args);
    },
    map(fn, thisArg) {
      return apply(this, "map", fn, thisArg, undefined, arguments);
    },
    pop() {
      return noTracking(this, "pop");
    },
    push(...args) {
      return noTracking(this, "push", args);
    },
    reduce(fn, ...args) {
      return reduce(this, "reduce", fn, args);
    },
    reduceRight(fn, ...args) {
      return reduce(this, "reduceRight", fn, args);
    },
    shift() {
      return noTracking(this, "shift");
    },
    some(fn, thisArg) {
      return apply(this, "some", fn, thisArg, undefined, arguments);
    },
    splice(...args) {
      return noTracking(this, "splice", args);
    },
    toReversed() {
      return reactiveReadArray(this).toReversed();
    },
    toSorted(comparer) {
      return reactiveReadArray(this).toSorted(comparer);
    },
    toSpliced(...args) {
      return reactiveReadArray(this).toSpliced(...args);
    },
    unshift(...args) {
      return noTracking(this, "unshift", args);
    },
    values() {
      return iterator(this, "values", toReactive);
    }
  };
  function iterator(self2, method, wrapValue) {
    const arr = shallowReadArray(self2);
    const iter = arr[method]();
    if (arr !== self2 && !isShallow(self2)) {
      iter._next = iter.next;
      iter.next = () => {
        const result = iter._next();
        if (result.value) {
          result.value = wrapValue(result.value);
        }
        return result;
      };
    }
    return iter;
  }
  var arrayProto = Array.prototype;
  function apply(self2, method, fn, thisArg, wrappedRetFn, args) {
    const arr = shallowReadArray(self2);
    const needsWrap = arr !== self2 && !isShallow(self2);
    const methodFn = arr[method];
    if (methodFn !== arrayProto[method]) {
      const result2 = methodFn.apply(self2, args);
      return needsWrap ? toReactive(result2) : result2;
    }
    let wrappedFn = fn;
    if (arr !== self2) {
      if (needsWrap) {
        wrappedFn = function(item, index) {
          return fn.call(this, toReactive(item), index, self2);
        };
      } else if (fn.length > 2) {
        wrappedFn = function(item, index) {
          return fn.call(this, item, index, self2);
        };
      }
    }
    const result = methodFn.call(arr, wrappedFn, thisArg);
    return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
  }
  function reduce(self2, method, fn, args) {
    const arr = shallowReadArray(self2);
    let wrappedFn = fn;
    if (arr !== self2) {
      if (!isShallow(self2)) {
        wrappedFn = function(acc, item, index) {
          return fn.call(this, acc, toReactive(item), index, self2);
        };
      } else if (fn.length > 3) {
        wrappedFn = function(acc, item, index) {
          return fn.call(this, acc, item, index, self2);
        };
      }
    }
    return arr[method](wrappedFn, ...args);
  }
  function searchProxy(self2, method, args) {
    const arr = toRaw2(self2);
    track2(arr, "iterate", ARRAY_ITERATE_KEY);
    const res = arr[method](...args);
    if ((res === -1 || res === false) && isProxy(args[0])) {
      args[0] = toRaw2(args[0]);
      return arr[method](...args);
    }
    return res;
  }
  function noTracking(self2, method, args = []) {
    pauseTracking();
    startBatch();
    const res = toRaw2(self2)[method].apply(self2, args);
    endBatch();
    resetTracking();
    return res;
  }
  var isNonTrackableKeys = /* @__PURE__ */ shared.makeMap(`__proto__,__v_isRef,__isVue`);
  var builtInSymbols = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(shared.isSymbol));
  function hasOwnProperty(key) {
    if (!shared.isSymbol(key))
      key = String(key);
    const obj = toRaw2(this);
    track2(obj, "has", key);
    return obj.hasOwnProperty(key);
  }

  class BaseReactiveHandler {
    constructor(_isReadonly = false, _isShallow = false) {
      this._isReadonly = _isReadonly;
      this._isShallow = _isShallow;
    }
    get(target, key, receiver) {
      if (key === "__v_skip")
        return target["__v_skip"];
      const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
      if (key === "__v_isReactive") {
        return !isReadonly2;
      } else if (key === "__v_isReadonly") {
        return isReadonly2;
      } else if (key === "__v_isShallow") {
        return isShallow2;
      } else if (key === "__v_raw") {
        if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
          return target;
        }
        return;
      }
      const targetIsArray = shared.isArray(target);
      if (!isReadonly2) {
        let fn;
        if (targetIsArray && (fn = arrayInstrumentations[key])) {
          return fn;
        }
        if (key === "hasOwnProperty") {
          return hasOwnProperty;
        }
      }
      const res = Reflect.get(target, key, isRef3(target) ? target : receiver);
      if (shared.isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
        return res;
      }
      if (!isReadonly2) {
        track2(target, "get", key);
      }
      if (isShallow2) {
        return res;
      }
      if (isRef3(res)) {
        return targetIsArray && shared.isIntegerKey(key) ? res : res.value;
      }
      if (shared.isObject(res)) {
        return isReadonly2 ? readonly(res) : reactive2(res);
      }
      return res;
    }
  }

  class MutableReactiveHandler extends BaseReactiveHandler {
    constructor(isShallow2 = false) {
      super(false, isShallow2);
    }
    set(target, key, value, receiver) {
      let oldValue = target[key];
      if (!this._isShallow) {
        const isOldValueReadonly = isReadonly(oldValue);
        if (!isShallow(value) && !isReadonly(value)) {
          oldValue = toRaw2(oldValue);
          value = toRaw2(value);
        }
        if (!shared.isArray(target) && isRef3(oldValue) && !isRef3(value)) {
          if (isOldValueReadonly) {
            return false;
          } else {
            oldValue.value = value;
            return true;
          }
        }
      }
      const hadKey = shared.isArray(target) && shared.isIntegerKey(key) ? Number(key) < target.length : shared.hasOwn(target, key);
      const result = Reflect.set(target, key, value, isRef3(target) ? target : receiver);
      if (target === toRaw2(receiver)) {
        if (!hadKey) {
          trigger2(target, "add", key, value);
        } else if (shared.hasChanged(value, oldValue)) {
          trigger2(target, "set", key, value, oldValue);
        }
      }
      return result;
    }
    deleteProperty(target, key) {
      const hadKey = shared.hasOwn(target, key);
      const oldValue = target[key];
      const result = Reflect.deleteProperty(target, key);
      if (result && hadKey) {
        trigger2(target, "delete", key, undefined, oldValue);
      }
      return result;
    }
    has(target, key) {
      const result = Reflect.has(target, key);
      if (!shared.isSymbol(key) || !builtInSymbols.has(key)) {
        track2(target, "has", key);
      }
      return result;
    }
    ownKeys(target) {
      track2(target, "iterate", shared.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    }
  }

  class ReadonlyReactiveHandler extends BaseReactiveHandler {
    constructor(isShallow2 = false) {
      super(true, isShallow2);
    }
    set(target, key) {
      {
        warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
      }
      return true;
    }
    deleteProperty(target, key) {
      {
        warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target);
      }
      return true;
    }
  }
  var mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler;
  var readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler;
  var shallowReactiveHandlers = /* @__PURE__ */ new MutableReactiveHandler(true);
  var shallowReadonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler(true);
  var toShallow = (value) => value;
  var getProto = (v) => Reflect.getPrototypeOf(v);
  function createIterableMethod(method, isReadonly2, isShallow2) {
    return function(...args) {
      const target = this["__v_raw"];
      const rawTarget = toRaw2(target);
      const targetIsMap = shared.isMap(rawTarget);
      const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
      const isKeyOnly = method === "keys" && targetIsMap;
      const innerIterator = target[method](...args);
      const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
      !isReadonly2 && track2(rawTarget, "iterate", isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
      return {
        next() {
          const { value, done } = innerIterator.next();
          return done ? { value, done } : {
            value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
            done
          };
        },
        [Symbol.iterator]() {
          return this;
        }
      };
    };
  }
  function createReadonlyMethod(type) {
    return function(...args) {
      {
        const key = args[0] ? `on key "${args[0]}" ` : ``;
        warn(`${shared.capitalize(type)} operation ${key}failed: target is readonly.`, toRaw2(this));
      }
      return type === "delete" ? false : type === "clear" ? undefined : this;
    };
  }
  function createInstrumentations(readonly2, shallow) {
    const instrumentations = {
      get(key) {
        const target = this["__v_raw"];
        const rawTarget = toRaw2(target);
        const rawKey = toRaw2(key);
        if (!readonly2) {
          if (shared.hasChanged(key, rawKey)) {
            track2(rawTarget, "get", key);
          }
          track2(rawTarget, "get", rawKey);
        }
        const { has } = getProto(rawTarget);
        const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
        if (has.call(rawTarget, key)) {
          return wrap(target.get(key));
        } else if (has.call(rawTarget, rawKey)) {
          return wrap(target.get(rawKey));
        } else if (target !== rawTarget) {
          target.get(key);
        }
      },
      get size() {
        const target = this["__v_raw"];
        !readonly2 && track2(toRaw2(target), "iterate", ITERATE_KEY);
        return Reflect.get(target, "size", target);
      },
      has(key) {
        const target = this["__v_raw"];
        const rawTarget = toRaw2(target);
        const rawKey = toRaw2(key);
        if (!readonly2) {
          if (shared.hasChanged(key, rawKey)) {
            track2(rawTarget, "has", key);
          }
          track2(rawTarget, "has", rawKey);
        }
        return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
      },
      forEach(callback, thisArg) {
        const observed = this;
        const target = observed["__v_raw"];
        const rawTarget = toRaw2(target);
        const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
        !readonly2 && track2(rawTarget, "iterate", ITERATE_KEY);
        return target.forEach((value, key) => {
          return callback.call(thisArg, wrap(value), wrap(key), observed);
        });
      }
    };
    shared.extend(instrumentations, readonly2 ? {
      add: createReadonlyMethod("add"),
      set: createReadonlyMethod("set"),
      delete: createReadonlyMethod("delete"),
      clear: createReadonlyMethod("clear")
    } : {
      add(value) {
        if (!shallow && !isShallow(value) && !isReadonly(value)) {
          value = toRaw2(value);
        }
        const target = toRaw2(this);
        const proto = getProto(target);
        const hadKey = proto.has.call(target, value);
        if (!hadKey) {
          target.add(value);
          trigger2(target, "add", value, value);
        }
        return this;
      },
      set(key, value) {
        if (!shallow && !isShallow(value) && !isReadonly(value)) {
          value = toRaw2(value);
        }
        const target = toRaw2(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
          key = toRaw2(key);
          hadKey = has.call(target, key);
        } else {
          checkIdentityKeys(target, has, key);
        }
        const oldValue = get.call(target, key);
        target.set(key, value);
        if (!hadKey) {
          trigger2(target, "add", key, value);
        } else if (shared.hasChanged(value, oldValue)) {
          trigger2(target, "set", key, value, oldValue);
        }
        return this;
      },
      delete(key) {
        const target = toRaw2(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
          key = toRaw2(key);
          hadKey = has.call(target, key);
        } else {
          checkIdentityKeys(target, has, key);
        }
        const oldValue = get ? get.call(target, key) : undefined;
        const result = target.delete(key);
        if (hadKey) {
          trigger2(target, "delete", key, undefined, oldValue);
        }
        return result;
      },
      clear() {
        const target = toRaw2(this);
        const hadItems = target.size !== 0;
        const oldTarget = shared.isMap(target) ? new Map(target) : new Set(target);
        const result = target.clear();
        if (hadItems) {
          trigger2(target, "clear", undefined, undefined, oldTarget);
        }
        return result;
      }
    });
    const iteratorMethods = [
      "keys",
      "values",
      "entries",
      Symbol.iterator
    ];
    iteratorMethods.forEach((method) => {
      instrumentations[method] = createIterableMethod(method, readonly2, shallow);
    });
    return instrumentations;
  }
  function createInstrumentationGetter(isReadonly2, shallow) {
    const instrumentations = createInstrumentations(isReadonly2, shallow);
    return (target, key, receiver) => {
      if (key === "__v_isReactive") {
        return !isReadonly2;
      } else if (key === "__v_isReadonly") {
        return isReadonly2;
      } else if (key === "__v_raw") {
        return target;
      }
      return Reflect.get(shared.hasOwn(instrumentations, key) && key in target ? instrumentations : target, key, receiver);
    };
  }
  var mutableCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(false, false)
  };
  var shallowCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(false, true)
  };
  var readonlyCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(true, false)
  };
  var shallowReadonlyCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(true, true)
  };
  function checkIdentityKeys(target, has, key) {
    const rawKey = toRaw2(key);
    if (rawKey !== key && has.call(target, rawKey)) {
      const type = shared.toRawType(target);
      warn(`Reactive ${type} contains both the raw and reactive versions of the same object${type === `Map` ? ` as keys` : ``}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`);
    }
  }
  var reactiveMap = /* @__PURE__ */ new WeakMap;
  var shallowReactiveMap = /* @__PURE__ */ new WeakMap;
  var readonlyMap = /* @__PURE__ */ new WeakMap;
  var shallowReadonlyMap = /* @__PURE__ */ new WeakMap;
  function targetTypeMap(rawType) {
    switch (rawType) {
      case "Object":
      case "Array":
        return 1;
      case "Map":
      case "Set":
      case "WeakMap":
      case "WeakSet":
        return 2;
      default:
        return 0;
    }
  }
  function getTargetType(value) {
    return value["__v_skip"] || !Object.isExtensible(value) ? 0 : targetTypeMap(shared.toRawType(value));
  }
  function reactive2(target) {
    if (isReadonly(target)) {
      return target;
    }
    return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
  }
  function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandlers, shallowCollectionHandlers, shallowReactiveMap);
  }
  function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
  }
  function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers, shallowReadonlyCollectionHandlers, shallowReadonlyMap);
  }
  function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
    if (!shared.isObject(target)) {
      {
        warn(`value cannot be made ${isReadonly2 ? "readonly" : "reactive"}: ${String(target)}`);
      }
      return target;
    }
    if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) {
      return target;
    }
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
      return existingProxy;
    }
    const targetType = getTargetType(target);
    if (targetType === 0) {
      return target;
    }
    const proxy = new Proxy(target, targetType === 2 ? collectionHandlers : baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
  }
  function isReactive2(value) {
    if (isReadonly(value)) {
      return isReactive2(value["__v_raw"]);
    }
    return !!(value && value["__v_isReactive"]);
  }
  function isReadonly(value) {
    return !!(value && value["__v_isReadonly"]);
  }
  function isShallow(value) {
    return !!(value && value["__v_isShallow"]);
  }
  function isProxy(value) {
    return value ? !!value["__v_raw"] : false;
  }
  function toRaw2(observed) {
    const raw = observed && observed["__v_raw"];
    return raw ? toRaw2(raw) : observed;
  }
  function markRaw2(value) {
    if (!shared.hasOwn(value, "__v_skip") && Object.isExtensible(value)) {
      shared.def(value, "__v_skip", true);
    }
    return value;
  }
  var toReactive = (value) => shared.isObject(value) ? reactive2(value) : value;
  var toReadonly = (value) => shared.isObject(value) ? readonly(value) : value;
  function isRef3(r) {
    return r ? r["__v_isRef"] === true : false;
  }
  function ref2(value) {
    return createRef2(value, false);
  }
  function shallowRef(value) {
    return createRef2(value, true);
  }
  function createRef2(rawValue, shallow) {
    if (isRef3(rawValue)) {
      return rawValue;
    }
    return new RefImpl(rawValue, shallow);
  }

  class RefImpl {
    constructor(value, isShallow2) {
      this.dep = new Dep;
      this["__v_isRef"] = true;
      this["__v_isShallow"] = false;
      this._rawValue = isShallow2 ? value : toRaw2(value);
      this._value = isShallow2 ? value : toReactive(value);
      this["__v_isShallow"] = isShallow2;
    }
    get value() {
      {
        this.dep.track({
          target: this,
          type: "get",
          key: "value"
        });
      }
      return this._value;
    }
    set value(newValue) {
      const oldValue = this._rawValue;
      const useDirectValue = this["__v_isShallow"] || isShallow(newValue) || isReadonly(newValue);
      newValue = useDirectValue ? newValue : toRaw2(newValue);
      if (shared.hasChanged(newValue, oldValue)) {
        this._rawValue = newValue;
        this._value = useDirectValue ? newValue : toReactive(newValue);
        {
          this.dep.trigger({
            target: this,
            type: "set",
            key: "value",
            newValue,
            oldValue
          });
        }
      }
    }
  }
  function triggerRef2(ref22) {
    if (ref22.dep) {
      {
        ref22.dep.trigger({
          target: ref22,
          type: "set",
          key: "value",
          newValue: ref22._value
        });
      }
    }
  }
  function unref3(ref22) {
    return isRef3(ref22) ? ref22.value : ref22;
  }
  function toValue(source) {
    return shared.isFunction(source) ? source() : unref3(source);
  }
  var shallowUnwrapHandlers = {
    get: (target, key, receiver) => key === "__v_raw" ? target : unref3(Reflect.get(target, key, receiver)),
    set: (target, key, value, receiver) => {
      const oldValue = target[key];
      if (isRef3(oldValue) && !isRef3(value)) {
        oldValue.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    }
  };
  function proxyRefs(objectWithRefs) {
    return isReactive2(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
  }

  class CustomRefImpl {
    constructor(factory) {
      this["__v_isRef"] = true;
      this._value = undefined;
      const dep = this.dep = new Dep;
      const { get, set } = factory(dep.track.bind(dep), dep.trigger.bind(dep));
      this._get = get;
      this._set = set;
    }
    get value() {
      return this._value = this._get();
    }
    set value(newVal) {
      this._set(newVal);
    }
  }
  function customRef(factory) {
    return new CustomRefImpl(factory);
  }
  function toRefs2(object) {
    if (!isProxy(object)) {
      warn(`toRefs() expects a reactive object but received a plain one.`);
    }
    const ret = shared.isArray(object) ? new Array(object.length) : {};
    for (const key in object) {
      ret[key] = propertyToRef(object, key);
    }
    return ret;
  }

  class ObjectRefImpl {
    constructor(_object, _key, _defaultValue) {
      this._object = _object;
      this._key = _key;
      this._defaultValue = _defaultValue;
      this["__v_isRef"] = true;
      this._value = undefined;
    }
    get value() {
      const val = this._object[this._key];
      return this._value = val === undefined ? this._defaultValue : val;
    }
    set value(newVal) {
      this._object[this._key] = newVal;
    }
    get dep() {
      return getDepFromReactive(toRaw2(this._object), this._key);
    }
  }

  class GetterRefImpl {
    constructor(_getter) {
      this._getter = _getter;
      this["__v_isRef"] = true;
      this["__v_isReadonly"] = true;
      this._value = undefined;
    }
    get value() {
      return this._value = this._getter();
    }
  }
  function toRef2(source, key, defaultValue) {
    if (isRef3(source)) {
      return source;
    } else if (shared.isFunction(source)) {
      return new GetterRefImpl(source);
    } else if (shared.isObject(source) && arguments.length > 1) {
      return propertyToRef(source, key, defaultValue);
    } else {
      return ref2(source);
    }
  }
  function propertyToRef(source, key, defaultValue) {
    const val = source[key];
    return isRef3(val) ? val : new ObjectRefImpl(source, key, defaultValue);
  }

  class ComputedRefImpl {
    constructor(fn, setter, isSSR) {
      this.fn = fn;
      this.setter = setter;
      this._value = undefined;
      this.dep = new Dep(this);
      this.__v_isRef = true;
      this.deps = undefined;
      this.depsTail = undefined;
      this.flags = 16;
      this.globalVersion = globalVersion - 1;
      this.next = undefined;
      this.effect = this;
      this["__v_isReadonly"] = !setter;
      this.isSSR = isSSR;
    }
    notify() {
      this.flags |= 16;
      if (!(this.flags & 8) && activeSub !== this) {
        batch(this, true);
        return true;
      }
    }
    get value() {
      const link = this.dep.track({
        target: this,
        type: "get",
        key: "value"
      });
      refreshComputed(this);
      if (link) {
        link.version = this.dep.version;
      }
      return this._value;
    }
    set value(newValue) {
      if (this.setter) {
        this.setter(newValue);
      } else {
        warn("Write operation failed: computed value is readonly");
      }
    }
  }
  function computed2(getterOrOptions, debugOptions, isSSR = false) {
    let getter;
    let setter;
    if (shared.isFunction(getterOrOptions)) {
      getter = getterOrOptions;
    } else {
      getter = getterOrOptions.get;
      setter = getterOrOptions.set;
    }
    const cRef = new ComputedRefImpl(getter, setter, isSSR);
    if (debugOptions && !isSSR) {
      cRef.onTrack = debugOptions.onTrack;
      cRef.onTrigger = debugOptions.onTrigger;
    }
    return cRef;
  }
  var TrackOpTypes = {
    GET: "get",
    HAS: "has",
    ITERATE: "iterate"
  };
  var TriggerOpTypes = {
    SET: "set",
    ADD: "add",
    DELETE: "delete",
    CLEAR: "clear"
  };
  var ReactiveFlags2 = {
    SKIP: "__v_skip",
    IS_REACTIVE: "__v_isReactive",
    IS_READONLY: "__v_isReadonly",
    IS_SHALLOW: "__v_isShallow",
    RAW: "__v_raw",
    IS_REF: "__v_isRef"
  };
  var WatchErrorCodes = {
    WATCH_GETTER: 2,
    "2": "WATCH_GETTER",
    WATCH_CALLBACK: 3,
    "3": "WATCH_CALLBACK",
    WATCH_CLEANUP: 4,
    "4": "WATCH_CLEANUP"
  };
  var INITIAL_WATCHER_VALUE = {};
  var cleanupMap = /* @__PURE__ */ new WeakMap;
  var activeWatcher = undefined;
  function getCurrentWatcher() {
    return activeWatcher;
  }
  function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
    if (owner) {
      let cleanups = cleanupMap.get(owner);
      if (!cleanups)
        cleanupMap.set(owner, cleanups = []);
      cleanups.push(cleanupFn);
    } else if (!failSilently) {
      warn(`onWatcherCleanup() was called when there was no active watcher to associate with.`);
    }
  }
  function watch2(source, cb, options = shared.EMPTY_OBJ) {
    const { immediate, deep, once, scheduler, augmentJob, call } = options;
    const warnInvalidSource = (s) => {
      (options.onWarn || warn)(`Invalid watch source: `, s, `A watch source can only be a getter/effect function, a ref, a reactive object, or an array of these types.`);
    };
    const reactiveGetter = (source2) => {
      if (deep)
        return source2;
      if (isShallow(source2) || deep === false || deep === 0)
        return traverse2(source2, 1);
      return traverse2(source2);
    };
    let effect2;
    let getter;
    let cleanup;
    let boundCleanup;
    let forceTrigger = false;
    let isMultiSource = false;
    if (isRef3(source)) {
      getter = () => source.value;
      forceTrigger = isShallow(source);
    } else if (isReactive2(source)) {
      getter = () => reactiveGetter(source);
      forceTrigger = true;
    } else if (shared.isArray(source)) {
      isMultiSource = true;
      forceTrigger = source.some((s) => isReactive2(s) || isShallow(s));
      getter = () => source.map((s) => {
        if (isRef3(s)) {
          return s.value;
        } else if (isReactive2(s)) {
          return reactiveGetter(s);
        } else if (shared.isFunction(s)) {
          return call ? call(s, 2) : s();
        } else {
          warnInvalidSource(s);
        }
      });
    } else if (shared.isFunction(source)) {
      if (cb) {
        getter = call ? () => call(source, 2) : source;
      } else {
        getter = () => {
          if (cleanup) {
            pauseTracking();
            try {
              cleanup();
            } finally {
              resetTracking();
            }
          }
          const currentEffect = activeWatcher;
          activeWatcher = effect2;
          try {
            return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
          } finally {
            activeWatcher = currentEffect;
          }
        };
      }
    } else {
      getter = shared.NOOP;
      warnInvalidSource(source);
    }
    if (cb && deep) {
      const baseGetter = getter;
      const depth = deep === true ? Infinity : deep;
      getter = () => traverse2(baseGetter(), depth);
    }
    const scope = getCurrentScope();
    const watchHandle = () => {
      effect2.stop();
      if (scope && scope.active) {
        shared.remove(scope.effects, effect2);
      }
    };
    if (once && cb) {
      const _cb = cb;
      cb = (...args) => {
        _cb(...args);
        watchHandle();
      };
    }
    let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
    const job = (immediateFirstRun) => {
      if (!(effect2.flags & 1) || !effect2.dirty && !immediateFirstRun) {
        return;
      }
      if (cb) {
        const newValue = effect2.run();
        if (deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => shared.hasChanged(v, oldValue[i])) : shared.hasChanged(newValue, oldValue))) {
          if (cleanup) {
            cleanup();
          }
          const currentWatcher = activeWatcher;
          activeWatcher = effect2;
          try {
            const args = [
              newValue,
              oldValue === INITIAL_WATCHER_VALUE ? undefined : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
              boundCleanup
            ];
            call ? call(cb, 3, args) : cb(...args);
            oldValue = newValue;
          } finally {
            activeWatcher = currentWatcher;
          }
        }
      } else {
        effect2.run();
      }
    };
    if (augmentJob) {
      augmentJob(job);
    }
    effect2 = new ReactiveEffect(getter);
    effect2.scheduler = scheduler ? () => scheduler(job, false) : job;
    boundCleanup = (fn) => onWatcherCleanup(fn, false, effect2);
    cleanup = effect2.onStop = () => {
      const cleanups = cleanupMap.get(effect2);
      if (cleanups) {
        if (call) {
          call(cleanups, 4);
        } else {
          for (const cleanup2 of cleanups)
            cleanup2();
        }
        cleanupMap.delete(effect2);
      }
    };
    {
      effect2.onTrack = options.onTrack;
      effect2.onTrigger = options.onTrigger;
    }
    if (cb) {
      if (immediate) {
        job(true);
      } else {
        oldValue = effect2.run();
      }
    } else if (scheduler) {
      scheduler(job.bind(null, true), true);
    } else {
      effect2.run();
    }
    watchHandle.pause = effect2.pause.bind(effect2);
    watchHandle.resume = effect2.resume.bind(effect2);
    watchHandle.stop = watchHandle;
    return watchHandle;
  }
  function traverse2(value, depth = Infinity, seen) {
    if (depth <= 0 || !shared.isObject(value) || value["__v_skip"]) {
      return value;
    }
    seen = seen || /* @__PURE__ */ new Set;
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
    depth--;
    if (isRef3(value)) {
      traverse2(value.value, depth, seen);
    } else if (shared.isArray(value)) {
      for (let i = 0;i < value.length; i++) {
        traverse2(value[i], depth, seen);
      }
    } else if (shared.isSet(value) || shared.isMap(value)) {
      value.forEach((v) => {
        traverse2(v, depth, seen);
      });
    } else if (shared.isPlainObject(value)) {
      for (const key in value) {
        traverse2(value[key], depth, seen);
      }
      for (const key of Object.getOwnPropertySymbols(value)) {
        if (Object.prototype.propertyIsEnumerable.call(value, key)) {
          traverse2(value[key], depth, seen);
        }
      }
    }
    return value;
  }
  exports2.ARRAY_ITERATE_KEY = ARRAY_ITERATE_KEY;
  exports2.EffectFlags = EffectFlags;
  exports2.EffectScope = EffectScope;
  exports2.ITERATE_KEY = ITERATE_KEY;
  exports2.MAP_KEY_ITERATE_KEY = MAP_KEY_ITERATE_KEY;
  exports2.ReactiveEffect = ReactiveEffect;
  exports2.ReactiveFlags = ReactiveFlags2;
  exports2.TrackOpTypes = TrackOpTypes;
  exports2.TriggerOpTypes = TriggerOpTypes;
  exports2.WatchErrorCodes = WatchErrorCodes;
  exports2.computed = computed2;
  exports2.customRef = customRef;
  exports2.effect = effect;
  exports2.effectScope = effectScope;
  exports2.enableTracking = enableTracking;
  exports2.getCurrentScope = getCurrentScope;
  exports2.getCurrentWatcher = getCurrentWatcher;
  exports2.isProxy = isProxy;
  exports2.isReactive = isReactive2;
  exports2.isReadonly = isReadonly;
  exports2.isRef = isRef3;
  exports2.isShallow = isShallow;
  exports2.markRaw = markRaw2;
  exports2.onEffectCleanup = onEffectCleanup;
  exports2.onScopeDispose = onScopeDispose;
  exports2.onWatcherCleanup = onWatcherCleanup;
  exports2.pauseTracking = pauseTracking;
  exports2.proxyRefs = proxyRefs;
  exports2.reactive = reactive2;
  exports2.reactiveReadArray = reactiveReadArray;
  exports2.readonly = readonly;
  exports2.ref = ref2;
  exports2.resetTracking = resetTracking;
  exports2.shallowReactive = shallowReactive;
  exports2.shallowReadArray = shallowReadArray;
  exports2.shallowReadonly = shallowReadonly;
  exports2.shallowRef = shallowRef;
  exports2.stop = stop;
  exports2.toRaw = toRaw2;
  exports2.toReactive = toReactive;
  exports2.toReadonly = toReadonly;
  exports2.toRef = toRef2;
  exports2.toRefs = toRefs2;
  exports2.toValue = toValue;
  exports2.track = track2;
  exports2.traverse = traverse2;
  exports2.trigger = trigger2;
  exports2.triggerRef = triggerRef2;
  exports2.unref = unref3;
  exports2.watch = watch2;
});

// src/index.ts
var exports_src = {};
__export(exports_src, {
  watchEffect: () => watchEffect,
  watch: () => watch,
  updateState: () => updateState,
  unref: () => unref,
  triggerRef: () => triggerRef,
  trigger: () => trigger,
  trackVueReactiveEvents: () => trackVueReactiveEvents,
  track: () => track,
  toRefs: () => toRefs,
  toRef: () => toRef,
  toRaw: () => toRaw,
  setActiveEffect: () => setActiveEffect,
  runCleanupFunctions: () => runCleanupFunctions,
  resetProxyStats: () => resetProxyStats,
  ref: () => ref,
  reactive: () => reactive,
  markRaw: () => markRaw,
  isRefSymbol: () => isRefSymbol,
  isRef: () => isRef,
  isReactive: () => isReactive,
  isComputed: () => isComputed,
  getProxyStats: () => getProxyStats,
  deepToRaw: () => deepToRaw,
  deepEqual: () => deepEqual,
  deepClone: () => deepClone,
  createRendererBridgeEmitter: () => createRendererBridgeEmitter,
  createMainBridgeEmitter: () => createMainBridgeEmitter,
  createBridgeEmitter: () => createBridgeEmitter,
  computed: () => computed,
  cleanupEffect: () => cleanupEffect,
  activeEffect: () => activeEffect,
  UnsupportedStateError: () => UnsupportedStateError,
  SnapshotLimitError: () => SnapshotLimitError,
  SNAPSHOT_SHARED_COPY_LIMIT: () => SNAPSHOT_SHARED_COPY_LIMIT
});
module.exports = __toCommonJS(exports_src);

// src/utils.ts
function toRaw(observed) {
  let value = observed;
  while (value && value["__v_raw" /* RAW */]) {
    value = value["__v_raw" /* RAW */];
  }
  return value;
}
function unwrapForStore(value) {
  if (value["__v_isReactive" /* IS_REACTIVE */])
    return toRaw(value);
  if (Array.isArray(value)) {
    for (let i = 0;i < value.length; i++) {
      const child = value[i];
      if (child != null && typeof child === "object" && child["__v_isReactive" /* IS_REACTIVE */])
        storeRawChild(value, i, child);
    }
  } else if (!(value instanceof Map) && !(value instanceof Set) && !(value instanceof Date)) {
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key))
        continue;
      const child = value[key];
      if (child != null && typeof child === "object" && child["__v_isReactive" /* IS_REACTIVE */])
        storeRawChild(value, key, child);
    }
  }
  return value;
}
var lookupSetter = Object.prototype.__lookupSetter__;
function storeRawChild(value, key, child) {
  if (lookupSetter === undefined) {
    if (Reflect.getOwnPropertyDescriptor(value, key)?.value === child)
      Reflect.set(value, key, toRaw(child));
    return;
  }
  if (lookupSetter.call(value, key) !== undefined)
    return;
  try {
    value[key] = toRaw(child);
  } catch {}
}
var MAX_CACHE_SIZE = 1000;
var pathCache = new WeakMap;
var pathCacheSize = new WeakMap;
var globalSeen = new WeakMap;
var wrapperCache = new WeakMap;
var locationNodes = new WeakMap;
var proxyStats = {
  created: 0,
  arrays: 0,
  maps: 0,
  sets: 0,
  objects: 0,
  staleEvicted: 0,
  detachedWrites: 0
};
function getProxyStats() {
  return { ...proxyStats, pathConcatCacheSize: 0 };
}
function resetProxyStats() {
  proxyStats.created = 0;
  proxyStats.arrays = 0;
  proxyStats.maps = 0;
  proxyStats.sets = 0;
  proxyStats.objects = 0;
  proxyStats.staleEvicted = 0;
  proxyStats.detachedWrites = 0;
}
function cleanupPathCache(root) {
  const cache = pathCache.get(root);
  if (cache && pathCacheSize.get(root) > MAX_CACHE_SIZE) {
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    let count = 0;
    for (const key of cache.keys()) {
      if (count >= entriesToRemove)
        break;
      cache.delete(key);
      count++;
    }
    pathCacheSize.set(root, MAX_CACHE_SIZE - entriesToRemove);
  }
}
function deepEqual(a, b, seen) {
  if (a === b)
    return true;
  if (a == null || b == null)
    return false;
  if (typeof a !== typeof b)
    return false;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (typeof a !== "object")
    return false;
  if (Array.isArray(a) !== Array.isArray(b))
    return false;
  if (seen !== undefined) {
    if (seen.has(a))
      return seen.get(a) === b;
    seen.set(a, b);
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length)
      return false;
    for (let i = 0;i < a.length; i++) {
      const left = a[i];
      if (left === undefined && !(i in a))
        continue;
      const right = b[i];
      if (left === right)
        continue;
      if (isObject(left) && isObject(right))
        seen ??= startSeen(a, b);
      if (!deepEqual(left, right, seen))
        return false;
    }
    return true;
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size)
      return false;
    for (const [key, left] of a) {
      if (!b.has(key))
        return false;
      const right = b.get(key);
      if (left === right)
        continue;
      if (isObject(left) && isObject(right))
        seen ??= startSeen(a, b);
      if (!deepEqual(left, right, seen))
        return false;
    }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size)
      return false;
    for (const value of a) {
      if (!b.has(value))
        return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length)
    return false;
  for (let i = 0;i < keysA.length; i++) {
    const key = keysA[i];
    if (!hasOwn.call(b, key))
      return false;
    const left = a[key];
    const right = b[key];
    if (left === right)
      continue;
    if (isObject(left) && isObject(right))
      seen ??= startSeen(a, b);
    if (!deepEqual(left, right, seen))
      return false;
  }
  return true;
}
function startSeen(a, b) {
  const seen = new WeakMap;
  seen.set(a, b);
  return seen;
}
function setInPathCache(root, pathKey, value) {
  if (!pathCache.has(root)) {
    pathCache.set(root, new Map);
    pathCacheSize.set(root, 0);
  }
  const cache = pathCache.get(root);
  if (!cache.has(pathKey)) {
    pathCacheSize.set(root, pathCacheSize.get(root) + 1);
  } else {
    cache.delete(pathKey);
  }
  cache.set(pathKey, value);
  cleanupPathCache(root);
}
function evictDescendantsFromPathCache(root, pathKey) {
  const cache = pathCache.get(root);
  if (!cache)
    return;
  let evicted = 0;
  if (cache.has(pathKey)) {
    cache.delete(pathKey);
    evicted++;
  }
  const prefix = pathKey + ".";
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      evicted++;
    }
  }
  if (evicted > 0) {
    pathCacheSize.set(root, (pathCacheSize.get(root) ?? cache.size) - evicted);
  }
}
function isObject(val) {
  return val !== null && typeof val === "object";
}
function traverse(value, seen = new Set) {
  if (!isObject(value) || seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.length;
    for (let i = 0;i < value.length; i++) {
      traverse(value[i], seen);
    }
  } else if (value instanceof Set || value instanceof Map) {
    value.size;
    const rawValue = value.__v_raw || value;
    for (const v of rawValue) {
      if (Array.isArray(v)) {
        traverse(v[0], seen);
        traverse(v[1], seen);
      } else {
        traverse(v, seen);
      }
    }
    return value;
  } else {
    Object.keys(value).length;
    for (const key in value) {
      traverse(value[key], seen);
    }
  }
  return value;
}
var SNAPSHOT_SHARED_COPY_LIMIT = 1e5;

class SnapshotLimitError extends RangeError {
  constructor(extraCopies) {
    super(`reactive-proxy-state: a snapshot would copy shared objects more than ` + `${SNAPSHOT_SHARED_COPY_LIMIT} extra times (counted ${extraCopies} before stopping; ` + `an object is copied once per place it holds). Nothing was changed. To remove such a ` + `graph, see "Shared graphs have a copy limit" under "Synchronization Limits" in the README`);
    this.name = "SnapshotLimitError";
  }
}

class UnsupportedStateError extends TypeError {
  constructor(problem) {
    super(`reactive-proxy-state: ${problem}. Nothing was changed. See "Supported inputs" under ` + `"Synchronization Limits" in the README`);
    this.name = "UnsupportedStateError";
  }
}
var SNAPSHOT_CHECK_AFTER = SNAPSHOT_SHARED_COPY_LIMIT + 1;
function cloneTree(value, named) {
  return copyTree(value, undefined, undefined, false, named);
}
var REACHES = Symbol("reaches");
function cloneTreeUnless(value, container, named) {
  return copyUnless(value, container, false, named);
}
function cloneStored(value, container, named) {
  return copyUnless(value, container, true, named);
}
var copiedFresh = false;
function copyUnless(value, container, checkFresh, named) {
  try {
    return copyTree(value, container, undefined, checkFresh, named);
  } catch (error) {
    if (error === reachedContainer) {
      copiedFresh = false;
      return REACHES;
    }
    throw error;
  }
}
function cloneTreeAfter(value, container, contents, named) {
  return copyTree(value, container, contents, false, named);
}
var reachedContainer = new Error("reactive-proxy-state: internal, a copy reached its container");
function copyTree(value, container, contents, checkFresh, named) {
  if (value === null || typeof value !== "object") {
    if (checkFresh)
      copiedFresh = true;
    return value;
  }
  const top = toRaw(value);
  if (top === value && top !== container) {
    const small = copySmall(value, container, checkFresh, named);
    if (small !== undefined)
      return small;
  }
  const base = cloneAncestors.length;
  const workBase = cloneWork.length;
  const outerTop = cloneTop;
  const outerCountdown = cloneCountdown;
  const outerContainer = cloneContainer;
  const outerContents = cloneContents;
  const outerFresh = cloneFresh;
  const outerFirst = cloneFirst;
  const outerSeen = cloneSeen;
  const outerBase = cloneBase;
  const outerIndex = cloneIndex;
  const outerNamed = cloneNamed;
  cloneTop = top;
  cloneCountdown = SNAPSHOT_CHECK_AFTER;
  cloneContainer = container;
  cloneContents = contents;
  cloneFresh = checkFresh && locationNodes.get(top) === undefined;
  cloneFirst = undefined;
  cloneSeen = undefined;
  cloneBase = base;
  cloneIndex = undefined;
  cloneNamed = named;
  try {
    const copy = cloneEntry(value, 0, named);
    if (checkFresh)
      copiedFresh = cloneFresh;
    return copy;
  } finally {
    cloneAncestors.length = base;
    cloneCopies.length = base;
    cloneWork.length = workBase;
    cloneTop = outerTop;
    cloneCountdown = outerCountdown;
    cloneContainer = outerContainer;
    cloneContents = outerContents;
    cloneFresh = outerFresh;
    cloneFirst = outerFirst;
    cloneSeen = outerSeen;
    cloneBase = outerBase;
    cloneIndex = outerIndex;
    cloneNamed = outerNamed;
  }
}
var cloneTop;
var cloneCountdown = 0;
var cloneContainer;
var cloneContents;
var cloneFresh = false;
var cloneFirst;
var cloneSeen;
var cloneNamed = 0 /* None */;
function copySmall(value, container, checkFresh, named) {
  if (!Array.isArray(value)) {
    const copy2 = copyLeaf(value);
    if (copy2 !== undefined && checkFresh)
      copiedFresh = locationNodes.get(value) === undefined;
    return copy2;
  }
  const length = value.length;
  if (length > 8)
    return;
  if (named === 2 /* All */ && namedKeys(value) !== undefined)
    return;
  const copy = new Array(length);
  let fresh = checkFresh && locationNodes.get(value) === undefined;
  for (let i = 0;i < length; i++) {
    const item = value[i];
    if (item === null || typeof item !== "object") {
      if (item !== undefined || i in value)
        copy[i] = item;
      continue;
    }
    if (item === container || toRaw(item) !== item)
      return;
    const leaf = copyLeaf(item);
    if (leaf === undefined)
      return;
    copy[i] = leaf;
    if (fresh)
      fresh = locationNodes.get(item) === undefined && value.indexOf(item) === i;
  }
  if (checkFresh)
    copiedFresh = fresh;
  return copy;
}
function copyLeaf(value) {
  if (Object.getPrototypeOf(value) !== Object.prototype)
    return;
  const copy = {};
  for (const key in value) {
    if (!hasOwn.call(value, key))
      continue;
    const entry = value[key];
    if (entry !== null && typeof entry === "object")
      return;
    if (key === "__proto__")
      setData(copy, key, entry);
    else
      copy[key] = entry;
  }
  if (Object.getOwnPropertySymbols(value).length !== 0)
    return;
  return copy;
}
function readsOf(identity) {
  if (identity !== cloneContainer)
    return identity;
  if (cloneContents === undefined)
    throw reachedContainer;
  return cloneContents;
}
function countCopy() {
  if (--cloneCountdown === 0) {
    if (cloneFresh)
      cloneCountdown = SNAPSHOT_CHECK_AFTER;
    else
      checkSharedCopies(cloneTop);
  }
}
function noteFresh(value) {
  const identity = toRaw(value);
  if (identity !== value || identity === cloneTop || locationNodes.get(identity) !== undefined) {
    cloneFresh = false;
    return;
  }
  const first = cloneFirst;
  if (first === undefined) {
    cloneFirst = identity;
    return;
  }
  if (identity === first) {
    cloneFresh = false;
    return;
  }
  let seen = cloneSeen;
  if (seen === undefined) {
    seen = cloneSeen = new Set;
    seen.add(first);
  }
  const size = seen.size;
  seen.add(identity);
  if (seen.size === size)
    cloneFresh = false;
}
function namedKeys(array) {
  const keys = Object.keys(array);
  let start = keys.length;
  while (start > 0 && !isIndexKey(keys[start - 1]))
    start--;
  const symbols = Object.getOwnPropertySymbols(array);
  let names = start === keys.length ? undefined : keys.slice(start);
  for (let i = 0;i < symbols.length; i++) {
    if (isEnumerable.call(array, symbols[i]))
      (names ??= []).push(symbols[i]);
  }
  return names;
}
function isIndexKey(key) {
  const length = key.length;
  if (length === 0 || length > 10)
    return false;
  const first = key.charCodeAt(0);
  if (first < 48 || first > 57 || first === 48 && length > 1)
    return false;
  for (let i = 1;i < length; i++) {
    const code = key.charCodeAt(i);
    if (code < 48 || code > 57)
      return false;
  }
  return length < 10 || Number(key) < 4294967295;
}
function setData(object, key, value) {
  Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
}
function checkSharedCopies(value) {
  const walk = { extra: 0, low: Infinity, marks: new Map };
  walkCopies(value, walk);
  if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT)
    throw new SnapshotLimitError(walk.extra);
}
function walkCopies(top, walk) {
  const frames = [];
  enterCopies(top, 0, walk, frames);
  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (frame.next < frame.entries.length && walk.extra <= SNAPSHOT_SHARED_COPY_LIMIT) {
      const entry = frame.entries[frame.next++];
      if (entry === null || typeof entry !== "object") {
        walk.low = Infinity;
        continue;
      }
      const size = enterCopies(entry, frame.depth + 1, walk, frames);
      if (frames[frames.length - 1] !== frame)
        continue;
      frame.size += size;
      if (walk.low < frame.low)
        frame.low = walk.low;
      continue;
    }
    frames.pop();
    walk.marks.set(frame.identity, frame.low > frame.depth ? frame.size : -1);
    walk.low = frame.low;
    const below = frames[frames.length - 1];
    if (below !== undefined) {
      below.size += frame.size;
      if (frame.low < below.low)
        below.low = frame.low;
    }
  }
}
function enterCopies(value, depth, walk, frames) {
  const identity = toRaw(value);
  const source = identity === cloneContainer ? readsOf(identity) : identity;
  const marks = walk.marks;
  const mark = marks.get(identity);
  if (mark !== undefined) {
    if (mark <= -2) {
      walk.low = -mark - 2;
      return 0;
    }
    walk.low = Infinity;
    if (mark > 0) {
      walk.extra += mark;
      return mark;
    }
    walk.extra++;
  }
  if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT) {
    if (mark === undefined)
      marks.set(identity, 1);
    walk.low = Infinity;
    return 1;
  }
  marks.set(identity, -(depth + 2));
  frames.push({ identity, depth, entries: entriesOf(source, identity), next: 0, size: 1, low: Infinity });
  return 0;
}
function entriesOf(source, identity) {
  if (Array.isArray(source)) {
    const names = keepsNamed(cloneNamed, identity === cloneTop ? 0 : 1) ? namedKeys(source) : undefined;
    if (names === undefined)
      return source;
    const entries2 = source.slice();
    for (let i = 0;i < names.length; i++)
      entries2.push(source[names[i]]);
    return entries2;
  }
  const entries = [];
  if (source instanceof Map) {
    for (const [key, entry] of Map.prototype.entries.call(source))
      entries.push(key, entry);
  } else if (source instanceof Set) {
    for (const entry of Set.prototype.values.call(source))
      entries.push(entry);
  }
  for (const key in source)
    if (hasOwn.call(source, key))
      entries.push(source[key]);
  const symbolKeys = Object.getOwnPropertySymbols(source);
  for (let i = 0;i < symbolKeys.length; i++) {
    if (isEnumerable.call(source, symbolKeys[i]))
      entries.push(source[symbolKeys[i]]);
  }
  return entries;
}
var cloneAncestors = [];
var cloneCopies = [];
var cloneBase = 0;
var cloneIndex;
var DEEP_PATH = 64;
var cloneWork = [];
var FILL_DEPTH = 256;
var hasOwn = Object.prototype.hasOwnProperty;
var isEnumerable = Object.prototype.propertyIsEnumerable;
function enterPath(identity, copy, depth) {
  cloneAncestors.push(identity);
  cloneCopies.push(copy);
  if (depth < DEEP_PATH)
    return;
  if (cloneIndex !== undefined) {
    cloneIndex.set(identity, copy);
    return;
  }
  cloneIndex = new Map;
  for (let i = cloneBase;i < cloneAncestors.length; i++)
    cloneIndex.set(cloneAncestors[i], cloneCopies[i]);
}
function leavePath(length) {
  const ancestors = cloneAncestors;
  const index = cloneIndex;
  while (ancestors.length > length) {
    const identity = ancestors.pop();
    cloneCopies.pop();
    if (index !== undefined)
      index.delete(identity);
  }
  if (index !== undefined && length - cloneBase <= DEEP_PATH)
    cloneIndex = undefined;
}
function cloneValue(value, depth, named) {
  if (value === null || typeof value !== "object")
    return value;
  if (cloneFresh)
    noteFresh(value);
  return cloneEntry(value, depth, named);
}
function keepsNamed(named, depth) {
  return named === 2 /* All */ || named === 1 /* Below */ && depth > 0;
}
function cloneEntry(value, depth, named) {
  const identity = toRaw(value);
  if (identity === cloneContainer)
    value = readsOf(identity);
  if (depth > DEEP_PATH) {
    const ancestor = cloneIndex.get(identity);
    if (ancestor !== undefined)
      return ancestor;
  } else {
    const ancestors = cloneAncestors;
    for (let i = ancestors.length - 1, stop = ancestors.length - depth;i >= stop; i--) {
      if (ancestors[i] === identity)
        return cloneCopies[i];
    }
  }
  countCopy();
  let copy;
  let kind;
  if (Array.isArray(value)) {
    copy = new Array(value.length);
    kind = 1 /* Array */;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === Object.prototype) {
      copy = {};
      kind = 0 /* Object */;
    } else if (value instanceof Date) {
      copy = new Date(value.getTime());
      kind = 0 /* Object */;
    } else if (value instanceof Map) {
      copy = new Map;
      kind = 2 /* Map */;
    } else if (value instanceof Set) {
      copy = new Set;
      kind = 3 /* Set */;
    } else {
      copy = Object.create(prototype);
      kind = 0 /* Object */;
    }
  }
  if (depth >= FILL_DEPTH - 1) {
    cloneDeep(kind, value, identity, copy, depth, named);
    return copy;
  }
  const below = depth + 1;
  let pushed = false;
  if (kind === 0 /* Object */) {
    for (const key in value) {
      if (!hasOwn.call(value, key))
        continue;
      let child = value[key];
      if (child !== null && typeof child === "object") {
        if (!pushed) {
          pushed = true;
          enterPath(identity, copy, depth);
        }
        if (cloneFresh)
          noteFresh(child);
        child = cloneEntry(child, below, named);
      }
      if (key === "__proto__")
        setData(copy, key, child);
      else
        copy[key] = child;
    }
    const symbolKeys = Object.getOwnPropertySymbols(value);
    if (symbolKeys.length !== 0)
      pushed = fillSymbols(value, identity, copy, depth, named, symbolKeys, pushed);
  } else if (kind === 1 /* Array */) {
    const length = copy.length;
    for (let i = 0;i < length; i++) {
      const child = value[i];
      if (child === null || typeof child !== "object") {
        if (child !== undefined || i in value)
          copy[i] = child;
        continue;
      }
      if (!pushed) {
        pushed = true;
        enterPath(identity, copy, depth);
      }
      if (cloneFresh)
        noteFresh(child);
      copy[i] = cloneEntry(child, below, named);
    }
    if (keepsNamed(named, depth))
      pushed = fillNamed(value, identity, copy, depth, named, pushed);
  } else {
    pushed = kind === 2 /* Map */ ? fillMap(value, identity, copy, depth, named) : fillSet(value, identity, copy, depth, named);
  }
  if (pushed) {
    if (depth < DEEP_PATH) {
      cloneAncestors.pop();
      cloneCopies.pop();
    } else {
      leavePath(cloneAncestors.length - 1);
    }
  }
  return copy;
}
function cloneDeep(kind, value, identity, copy, depth, named) {
  const pathLength = cloneAncestors.length;
  if (depth >= FILL_DEPTH) {
    cloneWork.push(kind, value, identity, copy, pathLength);
    return;
  }
  const workBase = cloneWork.length;
  fill(kind, value, identity, copy, depth, named);
  fillWaiting(workBase);
  leavePath(pathLength);
}
function fill(kind, value, identity, copy, depth, named) {
  if (kind === 0 /* Object */)
    fillObject(value, identity, copy, depth, named);
  else if (kind === 1 /* Array */)
    fillArray(value, identity, copy, depth, named);
  else if (kind === 2 /* Map */)
    fillMap(value, identity, copy, depth, named);
  else
    fillSet(value, identity, copy, depth, named);
}
function fillWaiting(workBase) {
  const work = cloneWork;
  while (work.length > workBase) {
    const at = work.length - 5;
    const kind = work[at];
    const value = work[at + 1];
    const identity = work[at + 2];
    const copy = work[at + 3];
    const pathLength = work[at + 4];
    work.length = at;
    if (cloneAncestors.length !== pathLength)
      leavePath(pathLength);
    fill(kind, value, identity, copy, FILL_DEPTH, cloneNamed);
  }
}
function fillObject(value, identity, copy, depth, named) {
  const below = depth + 1;
  let pushed = false;
  for (const key in value) {
    if (!hasOwn.call(value, key))
      continue;
    let child = value[key];
    if (child !== null && typeof child === "object") {
      if (!pushed) {
        pushed = true;
        enterPath(identity, copy, depth);
      }
      if (cloneFresh)
        noteFresh(child);
      child = cloneEntry(child, below, named);
    }
    if (key === "__proto__")
      setData(copy, key, child);
    else
      copy[key] = child;
  }
  const symbolKeys = Object.getOwnPropertySymbols(value);
  return symbolKeys.length === 0 ? pushed : fillSymbols(value, identity, copy, depth, named, symbolKeys, pushed);
}
function fillSymbols(value, identity, copy, depth, named, symbolKeys, pushed) {
  const below = depth + 1;
  for (let i = 0;i < symbolKeys.length; i++) {
    const symbolKey = symbolKeys[i];
    if (!isEnumerable.call(value, symbolKey))
      continue;
    const child = value[symbolKey];
    if (child !== null && typeof child === "object" && !pushed) {
      pushed = true;
      enterPath(identity, copy, depth);
    }
    copy[symbolKey] = cloneValue(child, below, named);
  }
  return pushed;
}
function fillArray(value, identity, copy, depth, named) {
  const below = depth + 1;
  let pushed = false;
  const length = copy.length;
  for (let i = 0;i < length; i++) {
    const child = value[i];
    if (child === null || typeof child !== "object") {
      if (child !== undefined || i in value)
        copy[i] = child;
      continue;
    }
    if (!pushed) {
      pushed = true;
      enterPath(identity, copy, depth);
    }
    if (cloneFresh)
      noteFresh(child);
    copy[i] = cloneEntry(child, below, named);
  }
  return keepsNamed(named, depth) ? fillNamed(value, identity, copy, depth, named, pushed) : pushed;
}
function fillNamed(value, identity, copy, depth, named, pushed) {
  const names = namedKeys(value);
  if (names === undefined)
    return pushed;
  const below = depth + 1;
  for (let i = 0;i < names.length; i++) {
    const child = value[names[i]];
    if (child !== null && typeof child === "object" && !pushed) {
      pushed = true;
      enterPath(identity, copy, depth);
    }
    setData(copy, names[i], cloneValue(child, below, named));
  }
  return pushed;
}
function fillMap(value, identity, copy, depth, named) {
  const below = depth + 1;
  enterPath(identity, copy, depth);
  const entries = toRaw(value);
  Map.prototype.forEach.call(entries, (entry, key) => {
    const keyCopy = cloneValue(key, below, named);
    copy.set(nameMember(key, keyCopy, entries, false), cloneValue(entry, below, named));
  });
  fillCollectionProperties(entries, copy, below, named);
  return true;
}
function fillSet(value, identity, copy, depth, named) {
  const below = depth + 1;
  enterPath(identity, copy, depth);
  const members = toRaw(value);
  let later;
  Set.prototype.forEach.call(members, (entry) => {
    if (entry === null || typeof entry !== "object") {
      copy.add(entry);
      return;
    }
    const raw = toRaw(entry);
    if (raw !== entry && later === undefined && Set.prototype.has.call(members, raw))
      later = laterTwins(members);
    if (later !== undefined && later.has(entry))
      return;
    const entryCopy = cloneValue(entry, below, named);
    if (copyingPayload)
      nameCopyOfCopy(entry, entryCopy);
    else
      nameRaw(raw, entry, entryCopy, members, false);
    copy.add(entryCopy);
  });
  fillCollectionProperties(members, copy, below, named);
  return true;
}
function laterTwins(set) {
  const seen = new Set;
  const later = new Set;
  Set.prototype.forEach.call(set, (member) => {
    if (member === null || typeof member !== "object")
      return;
    const raw = toRaw(member);
    if (seen.has(raw))
      later.add(member);
    else
      seen.add(raw);
  });
  return later;
}
function fillCollectionProperties(value, copy, depth, named) {
  for (const key in value) {
    if (hasOwn.call(value, key))
      setData(copy, key, cloneValue(value[key], depth, named));
  }
  const symbols = Object.getOwnPropertySymbols(value);
  for (let i = 0;i < symbols.length; i++) {
    if (isEnumerable.call(value, symbols[i]))
      setData(copy, symbols[i], cloneValue(value[symbols[i]], depth, named));
  }
}
var collectionIdentityKey = Symbol.for("@yiin/reactive-proxy-state.collection-identities.v3");
var collectionIdentities = Reflect.get(globalThis, collectionIdentityKey) ?? { members: new WeakMap, copies: new WeakMap, indexes: new WeakMap, overrides: new WeakMap };
if (!Reflect.has(globalThis, collectionIdentityKey)) {
  Object.defineProperty(globalThis, collectionIdentityKey, { value: collectionIdentities });
}
function ownToken(member) {
  const token = { shared: false };
  collectionIdentities.members.set(member, token);
  return token;
}
function nameMember(member, copy, collection, entering) {
  if (member === null || typeof member !== "object" || copy === null || typeof copy !== "object")
    return copy;
  if (copyingPayload) {
    nameCopyOfCopy(member, copy);
    return copy;
  }
  return nameRaw(toRaw(member), member, copy, collection, entering);
}
function nameKey(key, collection, entering) {
  const raw = toRaw(key);
  const own = collectionIdentities.members.get(raw);
  if (own !== undefined && !own.shared)
    return key;
  return nameRaw(raw, key, key, collection, entering);
}
function nameRaw(raw, member, copy, collection, entering) {
  const own = collectionIdentities.members.get(raw);
  let token;
  if (own === undefined)
    token = entering ? ownToken(raw) : namedInPlace(raw, collection);
  else if (!own.shared)
    token = own;
  else
    token = sharedTokenIn(raw, own, collection, entering);
  if (copy !== member) {
    collectionIdentities.copies.set(copy, token);
    return copy;
  }
  return own === undefined || token === own ? copy : carrier(raw, token);
}
function namedInPlace(member, collection) {
  const origin = collectionIdentities.copies.get(member);
  if (origin === undefined)
    return ownToken(member);
  const index = replicaIndex(collection, true);
  const held = heldMember(collection, index, origin);
  if (held !== undefined && held !== member) {
    const token = ownToken(member);
    index.byToken.set(token, member);
    return token;
  }
  origin.shared = true;
  collectionIdentities.members.set(member, origin);
  index.byToken.set(origin, member);
  return origin;
}
function sharedTokenIn(member, token, collection, entering) {
  let inCollection = collectionIdentities.overrides.get(collection);
  const current = inCollection?.get(member) ?? token;
  if (!entering)
    return current;
  const index = replicaIndex(collection, true);
  const held = heldMember(collection, index, current);
  if (held === undefined || held === member)
    return current;
  const other = { shared: false };
  if (inCollection === undefined)
    collectionIdentities.overrides.set(collection, inCollection = new WeakMap);
  inCollection.set(member, other);
  index.byToken.set(other, member);
  return other;
}
function carrier(member, token) {
  const copy = cloneTree(member, 2 /* All */);
  collectionIdentities.copies.set(copy, token);
  return copy;
}
function nameCopyOfCopy(source, copy) {
  if (source === null || typeof source !== "object" || copy === null || typeof copy !== "object")
    return;
  const token = collectionIdentities.copies.get(source) ?? collectionIdentities.members.get(source);
  if (token !== undefined)
    collectionIdentities.copies.set(copy, token);
}
var copyingPayload = false;
function copyingPayloads(run) {
  const outer = copyingPayload;
  copyingPayload = true;
  try {
    return run();
  } finally {
    copyingPayload = outer;
  }
}
function eventToken(member) {
  const raw = toRaw(member);
  return collectionIdentities.members.get(raw) ?? collectionIdentities.copies.get(raw);
}
function replicaIndex(collection, member) {
  let index = collectionIdentities.indexes.get(collection);
  const size = collection.size;
  if (index === undefined || index.size !== size || index.member !== member) {
    index = { byToken: member ? memberIndex(collection) : copyIndex(collection), size, member };
    collectionIdentities.indexes.set(collection, index);
  }
  return index;
}
function membersOf(collection) {
  return collection instanceof Map ? Map.prototype.keys.call(collection) : Set.prototype.values.call(collection);
}
function copyIndex(collection) {
  const byToken = new Map;
  for (const member of membersOf(collection)) {
    if (member === null || typeof member !== "object")
      continue;
    const raw = toRaw(member);
    const token = collectionIdentities.copies.get(raw) ?? collectionIdentities.members.get(raw);
    if (token !== undefined && !byToken.has(token))
      byToken.set(token, member);
  }
  return byToken;
}
function memberIndex(collection) {
  const byToken = new Map;
  const overrides = collectionIdentities.overrides.get(collection);
  for (const member of membersOf(collection)) {
    if (member === null || typeof member !== "object")
      continue;
    const raw = toRaw(member);
    const own = overrides?.get(raw) ?? collectionIdentities.members.get(raw);
    if (own !== undefined) {
      byToken.set(own, member);
      continue;
    }
    const origin = collectionIdentities.copies.get(raw);
    if (origin !== undefined && !byToken.has(origin))
      byToken.set(origin, member);
  }
  return byToken;
}
function keepIndexSize(collection) {
  const index = collectionIdentities.indexes.get(collection);
  if (index !== undefined)
    index.size = collection.size;
}
function heldMember(raw, index, token) {
  const held = index.byToken.get(token);
  return held !== undefined && raw.has(held) ? held : undefined;
}
function newMember(raw, member, token, reactive) {
  let added = member;
  if (raw.has(member)) {
    added = cloneTree(member, 2 /* All */);
    collectionIdentities.copies.set(added, token);
  }
  if (reactive && !collectionIdentities.members.has(added)) {
    token.shared = true;
    collectionIdentities.members.set(added, token);
  }
  return added;
}
function objectToken(value) {
  return value !== null && typeof value === "object" ? eventToken(value) : undefined;
}
function replicaAdd(set, value) {
  const raw = toRaw(set);
  const token = objectToken(value);
  if (token === undefined) {
    set.add(value);
    keepIndexSize(raw);
    return;
  }
  const index = replicaIndex(raw, raw !== set);
  if (heldMember(raw, index, token) !== undefined)
    return;
  const member = newMember(raw, toRaw(value), token, set !== raw);
  set.add(member);
  index.byToken.set(token, member);
  index.size = raw.size;
}
function replicaDelete(set, value) {
  const raw = toRaw(set);
  const token = objectToken(value);
  if (token === undefined) {
    set.delete(value);
    keepIndexSize(raw);
    return;
  }
  const index = replicaIndex(raw, raw !== set);
  const held = heldMember(raw, index, token);
  set.delete(held === undefined ? value : held);
  index.byToken.delete(token);
  index.size = raw.size;
}
function replicaMapSet(map, key, value) {
  const raw = toRaw(map);
  const token = objectToken(key);
  if (token === undefined) {
    map.set(key, value);
    keepIndexSize(raw);
    return;
  }
  const index = replicaIndex(raw, raw !== map);
  const held = heldMember(raw, index, token);
  if (held !== undefined) {
    map.set(held, value);
    return;
  }
  const member = newMember(raw, toRaw(key), token, map !== raw);
  map.set(member, value);
  index.byToken.set(token, member);
  index.size = raw.size;
}
function replicaMapDelete(map, key) {
  const raw = toRaw(map);
  const token = objectToken(key);
  if (token === undefined) {
    map.delete(key);
    keepIndexSize(raw);
    return;
  }
  const index = replicaIndex(raw, raw !== map);
  const held = heldMember(raw, index, token);
  map.delete(held === undefined ? key : held);
  index.byToken.delete(token);
  index.size = raw.size;
}
function forgetReplicaIndex(collection) {
  collectionIdentities.indexes.delete(toRaw(collection));
}
function deepClone(value, seen = new WeakMap) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  const identity = toRaw(value);
  if (seen.has(identity)) {
    return seen.get(identity);
  }
  if (Array.isArray(value)) {
    const newArray = [];
    seen.set(identity, newArray);
    for (let i = 0;i < value.length; i++) {
      newArray[i] = deepClone(value[i], seen);
    }
    return newArray;
  }
  if (value instanceof Map) {
    const newMap = new Map;
    seen.set(identity, newMap);
    value.forEach((val, key) => {
      newMap.set(deepClone(key, seen), deepClone(val, seen));
    });
    return newMap;
  }
  if (value instanceof Set) {
    const newSet = new Set;
    seen.set(identity, newSet);
    value.forEach((val) => {
      newSet.add(deepClone(val, seen));
    });
    return newSet;
  }
  const newObject = Object.create(Object.getPrototypeOf(value));
  seen.set(identity, newObject);
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      newObject[key] = deepClone(value[key], seen);
    }
  }
  const symbolKeys = Object.getOwnPropertySymbols(value);
  for (const symbolKey of symbolKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, symbolKey);
    if (descriptor && Object.prototype.propertyIsEnumerable.call(value, symbolKey)) {
      newObject[symbolKey] = deepClone(value[symbolKey], seen);
    }
  }
  return newObject;
}
// src/location.ts
class Place {
  parentRef;
  parentId;
  key;
  constructor(parent, key) {
    this.parentRef = new WeakRef(parent);
    this.parentId = parent.id;
    this.key = key;
    parent.childPlaces++;
  }
  get parent() {
    return this.parentRef.deref();
  }
}
function dropped(place) {
  const parent = place.parent;
  if (parent !== undefined)
    parent.childPlaces--;
}
var WIDE = 8;
var nodes = locationNodes;
var nodeCount = 0;
var FAST_CHAIN_LIMIT = 256;
function isObject2(value) {
  return value !== null && typeof value === "object";
}
function getLocationNode(raw) {
  return nodes.get(raw);
}
function ensureLocationNode(raw) {
  let node = nodes.get(raw);
  if (node === undefined) {
    node = {
      id: ++nodeCount,
      raw,
      kind: raw instanceof Map ? 1 /* Map */ : raw instanceof Set ? 2 /* Set */ : 0 /* Plain */,
      places: [],
      root: undefined,
      scope: undefined,
      proxy: undefined,
      evicted: undefined,
      relinked: 0,
      relinkedPlaces: 0,
      lostLink: false,
      dataOnly: undefined,
      childPlaces: 0,
      walk: 0,
      touched: 0,
      pruned: 0,
      index: undefined
    };
    nodes.set(raw, node);
  }
  return node;
}
function writesThroughSetter(target, prop, node) {
  let dataOnly = node.dataOnly;
  if (dataOnly === undefined)
    dataOnly = node.dataOnly = hasNoOwnAccessor(target);
  if (dataOnly)
    return false;
  const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
  return descriptor !== undefined && descriptor.set !== undefined;
}
function hasNoOwnAccessor(target) {
  const keys = Reflect.ownKeys(target);
  if (keys.length > 64)
    return false;
  for (let i = 0;i < keys.length; i++) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, keys[i]);
    if (descriptor.get !== undefined || descriptor.set !== undefined)
      return false;
  }
  return true;
}
function holdsIn(parent, key, raw) {
  if (parent === undefined)
    return false;
  const container = parent.raw;
  switch (parent.kind) {
    case 1 /* Map */: {
      const held = container.get(key);
      return held === raw || proxyOf(held, raw);
    }
    case 2 /* Set */:
      return container.has(raw);
    default: {
      const held = container[key];
      return held === raw || proxyOf(held, raw);
    }
  }
}
function proxyOf(held, raw) {
  return isObject2(held) && held["__v_raw" /* RAW */] !== undefined && toRaw(held) === raw;
}
function holds(place, raw) {
  return holdsIn(place.parent, place.key, raw);
}
function segment(parent, key, raw) {
  if (parent.kind === 2 /* Set */) {
    let index = 0;
    for (const member of parent.raw) {
      if (member === raw)
        break;
      index++;
    }
    return String(index);
  }
  return String(key);
}
function samePlace(place, parent, key) {
  return place.parentId === parent.id && (parent.kind === 2 /* Set */ || place.key === key);
}
function chain(node, tail) {
  let reversed;
  let current = node;
  for (let steps = 0;steps < FAST_CHAIN_LIMIT; steps++) {
    const places = current.places;
    const root = current.root;
    if (root !== undefined) {
      if (places.length !== 0)
        return;
      return { root, paths: [buildPath(root.path, reversed, tail)] };
    }
    if (places.length !== 1)
      return places.length === 0 ? null : undefined;
    const place = places[0];
    const parent = place.parent;
    if (!holdsIn(parent, place.key, current.raw)) {
      dropped(place);
      current.places = [];
      return null;
    }
    (reversed ??= []).push(segment(parent, place.key, current.raw));
    current = parent;
  }
  return;
}
function findAll(node, tail, firstOnly) {
  const out = [];
  const segments = [];
  const visiting = new Set;
  const frames = [];
  const enter = (entered) => {
    visiting.add(entered);
    const root = entered.root;
    if (root !== undefined)
      out.push({ root, path: buildPath(root.path, segments, tail) });
    frames.push({ node: entered, places: entered.places, next: 0, stale: false });
  };
  enter(node);
  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    const current = frame.node;
    if (frame.next < frame.places.length && !(firstOnly && out.length > 0)) {
      const place = frame.places[frame.next++];
      const parent = place.parent;
      if (!holdsIn(parent, place.key, current.raw)) {
        frame.stale = true;
        continue;
      }
      if (visiting.has(parent))
        continue;
      segments.push(segment(parent, place.key, current.raw));
      enter(parent);
      continue;
    }
    frames.pop();
    if (frame.stale)
      current.places = keepPlaces(frame.places, (place) => holds(place, current.raw));
    visiting.delete(current);
    if (frames.length > 0)
      segments.pop();
  }
  return out;
}
function buildPath(base, reversed, tail) {
  const middle = reversed === undefined ? 0 : reversed.length;
  const path = new Array(base.length + middle + (tail === undefined ? 0 : 1));
  let index = 0;
  for (let i = 0;i < base.length; i++)
    path[index++] = base[i];
  for (let i = middle - 1;i >= 0; i--)
    path[index++] = reversed[i];
  if (tail !== undefined)
    path[index] = String(tail);
  return path;
}
function locate(node, tail) {
  const single = chain(node, tail);
  if (single !== undefined) {
    if (single === null) {
      proxyStats.detachedWrites++;
      return;
    }
    return single.root.emit === undefined ? undefined : single;
  }
  const found = findAll(node, tail, false);
  if (found.length === 0) {
    proxyStats.detachedWrites++;
    return;
  }
  let root = found[0].root;
  for (let i = 1;i < found.length; i++) {
    if (found[i].root !== root) {
      if (node.scope !== undefined && found.some((entry) => entry.root === node.scope)) {
        root = node.scope;
      }
      break;
    }
  }
  if (root.emit === undefined)
    return;
  const paths = [];
  for (let i = 0;i < found.length; i++) {
    if (found[i].root === root)
      paths.push(found[i].path);
  }
  return { root, paths };
}
function isAttached(node) {
  const single = chain(node, undefined);
  if (single !== undefined)
    return single !== null;
  return findAll(node, undefined, true).length > 0;
}
function attachedBefore(node, former) {
  let current = node;
  for (let steps = 0;steps < FAST_CHAIN_LIMIT; steps++) {
    if (current.root !== undefined || current === former)
      return true;
    const places = current.places;
    if (places.length !== 1)
      break;
    const place = places[0];
    const parent = place.parent;
    if (!holdsIn(parent, place.key, current.raw))
      return false;
    current = parent;
  }
  if (current.root !== undefined || current === former)
    return true;
  const visited = new Set;
  visited.add(current);
  const stack = [current];
  const next = [0];
  while (stack.length > 0) {
    const top = stack.length - 1;
    const at = stack[top];
    const places = at.places;
    if (next[top] >= places.length) {
      stack.pop();
      next.pop();
      continue;
    }
    const place = places[next[top]++];
    const parent = place.parent;
    if (!holdsIn(parent, place.key, at.raw))
      continue;
    if (parent.root !== undefined || parent === former)
      return true;
    if (visited.has(parent))
      continue;
    visited.add(parent);
    stack.push(parent);
    next.push(0);
  }
  return false;
}
function dispatch(target, event) {
  const { root, paths } = target;
  if (paths.length === 1) {
    if (root.undelivered === undefined)
      root.emit(event);
    else
      deliver(root, [event]);
    return;
  }
  deliver(root, copyingPayloads(() => copiesPerPath(event, paths, root.async)));
}
function copiesPerPath(event, paths, async) {
  const removesValue = event.action === "set-delete";
  const events = [event];
  for (let i = 1;i < paths.length; i++) {
    const copy = { ...event, path: paths[i] };
    if (isObject2(event.newValue))
      copy.newValue = cloneTree(event.newValue, event.action === "replace" ? 1 /* Below */ : 0 /* None */);
    if (isObject2(event.value) && !removesValue) {
      copy.value = cloneTree(event.value, 2 /* All */);
      nameCopyOfCopy(event.value, copy.value);
    }
    if (event.items !== undefined)
      copy.items = cloneTree(event.items, 1 /* Below */);
    if (async) {
      if (isObject2(event.oldValue))
        copy.oldValue = cloneTree(event.oldValue, 2 /* All */);
      if (event.oldValues !== undefined)
        copy.oldValues = cloneTree(event.oldValues, 1 /* Below */);
      if (removesValue) {
        copy.value = copy.oldValue;
        nameCopyOfCopy(event.value, copy.value);
      }
    }
    events.push(copy);
  }
  return events;
}
function deliver(root, events) {
  const emit = root.emit;
  let queue = root.undelivered;
  if (queue === undefined) {
    if (events.length === 1) {
      emit(events[0]);
      return;
    }
    queue = root.undelivered = { events, next: 0 };
  } else {
    for (let i = 0;i < events.length; i++)
      queue.events.push(events[i]);
  }
  let failed = false;
  let failure;
  while (queue.next < queue.events.length) {
    try {
      emit(queue.events[queue.next++]);
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  if (root.undelivered === queue)
    root.undelivered = undefined;
  if (failed)
    throw failure;
}
function copyPayload(event, target, container, held) {
  if (event === undefined)
    return 1 /* Done */;
  const removed = target.root.async;
  const { newValue, oldValue, value, items, oldValues } = event;
  const stored = event.action !== "set-delete";
  let fresh = true;
  let newCopy = newValue;
  if (isObject2(newValue)) {
    newCopy = held === undefined ? cloneStored(newValue, container, event.action === "replace" ? 1 /* Below */ : 0 /* None */) : cloneTreeUnless(newValue, container, event.action === "replace" ? 1 /* Below */ : 0 /* None */);
    if (newCopy === REACHES)
      return 0 /* Reaches */;
    fresh = held === undefined && copiedFresh;
  }
  let valueCopy = value;
  if (isObject2(value) && stored) {
    valueCopy = cloneStored(value, container, 2 /* All */);
    if (valueCopy === REACHES)
      return 0 /* Reaches */;
    fresh &&= copiedFresh;
  }
  let itemsCopy = items;
  if (items !== undefined && holdsObject(items)) {
    itemsCopy = cloneStored(items, container, 1 /* Below */);
    if (itemsCopy === REACHES)
      return 0 /* Reaches */;
    fresh &&= copiedFresh;
  }
  if (removed) {
    const oldCopy = isObject2(oldValue) ? cloneTreeUnless(oldValue, container, 2 /* All */) : oldValue;
    if (oldCopy === REACHES)
      return 0 /* Reaches */;
    const oldValuesCopy = oldValues !== undefined && holdsObject(oldValues) ? cloneTreeUnless(oldValues, container, 1 /* Below */) : oldValues;
    if (oldValuesCopy === REACHES)
      return 0 /* Reaches */;
    if (isObject2(oldValue))
      event.oldValue = oldCopy;
    if (oldValues !== undefined)
      event.oldValues = oldValuesCopy;
    if (!stored)
      valueCopy = event.oldValue;
  }
  if (isObject2(newValue))
    event.newValue = newCopy;
  if (isObject2(value))
    event.value = nameMember(value, valueCopy, container, stored);
  if (items !== undefined)
    event.items = itemsCopy;
  return fresh ? 2 /* Fresh */ : 1 /* Done */;
}
function copyPayloadReaching(event, target, container, after) {
  refuseAccessors(event, target.root.async, container, after);
  copyPayloadAfter(event, target, container, after);
}
function copyPayloadAfter(event, target, container, after) {
  const { newValue, oldValue, value, items, oldValues } = event;
  const removed = target.root.async;
  const stored = event.action !== "set-delete";
  const newCopy = isObject2(newValue) ? cloneTreeAfter(newValue, container, after, event.action === "replace" ? 1 /* Below */ : 0 /* None */) : newValue;
  const oldCopy = removed && isObject2(oldValue) ? cloneTreeAfter(oldValue, container, after, 2 /* All */) : oldValue;
  const valueCopy = !isObject2(value) ? value : stored ? cloneTreeAfter(value, container, after, 2 /* All */) : oldCopy;
  const itemsCopy = items !== undefined && holdsObject(items) ? cloneTreeAfter(items, container, after, 1 /* Below */) : items;
  const oldValuesCopy = removed && oldValues !== undefined && holdsObject(oldValues) ? cloneTreeAfter(oldValues, container, after, 1 /* Below */) : oldValues;
  if (isObject2(newValue))
    event.newValue = newCopy;
  if (isObject2(oldValue))
    event.oldValue = oldCopy;
  if (isObject2(value))
    event.value = nameMember(value, valueCopy, container, stored);
  if (items !== undefined)
    event.items = itemsCopy;
  if (oldValues !== undefined)
    event.oldValues = oldValuesCopy;
}
function holdsObject(values) {
  for (let i = 0;i < values.length; i++)
    if (isObject2(values[i]))
      return true;
  return false;
}
function shallowCopy(container) {
  const copy = Array.isArray(container) ? container.slice() : container instanceof Map ? new Map(Map.prototype.entries.call(container)) : container instanceof Set ? new Set(Set.prototype.values.call(container)) : Object.create(Object.getPrototypeOf(container));
  const keys = Reflect.ownKeys(container);
  for (let i = 0;i < keys.length; i++) {
    const value = enumerableData(container, keys[i]);
    if (value !== NOT_ENUMERABLE)
      setData(copy, keys[i], value);
  }
  return copy;
}
var NOT_ENUMERABLE = Symbol("not enumerable");
function enumerableData(object, key) {
  const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
  if (!descriptor.enumerable)
    return NOT_ENUMERABLE;
  if (descriptor.get !== undefined || descriptor.set !== undefined) {
    throw new UnsupportedStateError(`the accessor property '${String(key)}' sits in a payload that reaches back into the ` + `object it is written to, and a getter cannot be read as it will be after the write`);
  }
  return descriptor.value;
}
function refuseAccessors(event, removed, container, after) {
  const pending = [event.newValue];
  if (event.action !== "set-delete")
    pending.push(event.value);
  if (event.items !== undefined)
    pending.push(event.items);
  if (removed) {
    pending.push(event.oldValue);
    if (event.oldValues !== undefined)
      pending.push(event.oldValues);
  }
  const seen = new Set;
  while (pending.length > 0) {
    const entry = pending.pop();
    if (!isObject2(entry))
      continue;
    let value = toRaw(entry);
    if (value === container)
      value = after;
    if (seen.has(value))
      continue;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0;i < value.length; i++)
        pending.push(value[i]);
    } else if (value instanceof Map) {
      for (const [key, item] of Map.prototype.entries.call(value))
        pending.push(key, item);
    } else if (value instanceof Set) {
      for (const item of Set.prototype.values.call(value))
        pending.push(item);
    }
    const keys = Reflect.ownKeys(value);
    for (let i = 0;i < keys.length; i++) {
      const item = enumerableData(value, keys[i]);
      if (item !== NOT_ENUMERABLE)
        pending.push(item);
    }
  }
}
function addPlace(node, parent, key) {
  if (findPlace(node, parent, key) !== undefined)
    return false;
  pushPlace(node, new Place(parent, key));
  return true;
}
function findPlace(node, parent, key) {
  const places = node.places;
  if (places.length <= WIDE) {
    for (let i = 0;i < places.length; i++) {
      if (samePlace(places[i], parent, key))
        return places[i];
    }
    return;
  }
  let index = node.index;
  if (index === undefined || index.places !== places || index.length !== places.length) {
    index = node.index = { places, length: places.length, byParent: new Map };
    for (let i = 0;i < places.length; i++)
      indexPlace(index.byParent, places[i]);
  }
  const entry = index.byParent.get(parent.id);
  if (entry === undefined)
    return;
  if (entry instanceof Place)
    return parent.kind === 2 /* Set */ || entry.key === key ? entry : undefined;
  return entry.get(key);
}
function indexPlace(byParent, place) {
  const entry = byParent.get(place.parentId);
  if (entry === undefined)
    byParent.set(place.parentId, place);
  else if (entry instanceof Place) {
    if (entry.key !== place.key)
      byParent.set(place.parentId, new Map([[entry.key, entry], [place.key, place]]));
  } else if (!entry.has(place.key))
    entry.set(place.key, place);
}
function pushPlace(node, place) {
  const places = node.places;
  places.push(place);
  const index = node.index;
  if (index !== undefined && index.places === places && index.length === places.length - 1) {
    index.length++;
    indexPlace(index.byParent, place);
  }
}
function prunePlaces(node) {
  const count = node.places.length;
  if (count > WIDE && count < 2 * node.pruned)
    return;
  let places = keepPlaces(node.places, (place) => holds(place, node.raw));
  if (places.length > 1) {
    const live = pruneScratch;
    live.length = places.length;
    let attached = 0;
    let parent;
    let parentAttached = false;
    for (let i = 0;i < places.length; i++) {
      const next = places[i].parent;
      if (next !== parent) {
        parent = next;
        parentAttached = isAttached(next);
      }
      live[i] = parentAttached;
      if (parentAttached)
        attached++;
    }
    if (attached > 0 && attached < places.length) {
      const kept = [];
      for (let i = 0;i < places.length; i++) {
        if (live[i])
          kept.push(places[i]);
        else {
          markLostLink(places[i].parent);
          dropped(places[i]);
        }
      }
      places = kept;
    }
  }
  pruneScratch.length = 0;
  node.places = places;
  node.pruned = places.length;
}
var pruneScratch = [];
function keepPlaces(places, keep) {
  const kept = [];
  for (let i = 0;i < places.length; i++) {
    if (keep(places[i]))
      kept.push(places[i]);
    else
      dropped(places[i]);
  }
  return kept;
}
function markLostLink(node) {
  if (node.lostLink)
    return;
  node.lostLink = true;
  const pending = [node];
  while (pending.length > 0) {
    const places = pending.pop().places;
    for (let i = 0;i < places.length; i++) {
      const parent = places[i].parent;
      if (parent !== undefined && !parent.lostLink) {
        parent.lostLink = true;
        pending.push(parent);
      }
    }
  }
}
function notePlace(node, parent, key) {
  const places = node.places;
  if (places.length === 1 && samePlace(places[0], parent, key))
    return;
  if (addPlace(node, parent, key) && node.places.length > 1)
    prunePlaces(node);
}
function detachPlace(value, parent, key) {
  const node = nodes.get(value);
  if (node !== undefined)
    removePlace(node, parent, key);
}
function removePlace(node, parent, key) {
  const places = node.places;
  if (places.length <= WIDE) {
    for (let i = 0;i < places.length; i++) {
      if (samePlace(places[i], parent, key)) {
        dropped(places[i]);
        places.splice(i, 1);
        node.index = undefined;
        return true;
      }
    }
    return false;
  }
  const place = findPlace(node, parent, key);
  if (place === undefined)
    return false;
  const at = places.indexOf(place);
  if (at < 0) {
    node.index = undefined;
    return false;
  }
  dropped(place);
  places.splice(at, 1);
  const index = node.index;
  index.length--;
  const entry = index.byParent.get(place.parentId);
  if (entry === place)
    index.byParent.delete(place.parentId);
  else if (entry instanceof Map && entry.get(place.key) === place)
    entry.delete(place.key);
  return true;
}
function newWalk(touched, store, former, held, first) {
  return {
    id: ++stamps,
    store,
    firstId: nodeCount + 1,
    touched,
    seen: new Set,
    repeated: undefined,
    aliases: first?.repeated,
    created: undefined,
    revisit: first?.created,
    relinked: [],
    former,
    held
  };
}
function adoptFrame(raw, node, unknown, key) {
  let kind = 3 /* Object */;
  let keys;
  let entries;
  if (Array.isArray(raw))
    kind = 0 /* Array */;
  else if (raw instanceof Map) {
    kind = 1 /* Map */;
    entries = Map.prototype.entries.call(raw);
  } else if (raw instanceof Set) {
    kind = 2 /* Set */;
    entries = Set.prototype.values.call(raw);
  } else if (raw instanceof Date || ArrayBuffer.isView(raw))
    kind = 4 /* None */;
  else
    keys = Object.keys(raw);
  return { raw, node, unknown, key, kind, next: 0, keys, entries, childKey: undefined, swaps: undefined };
}
function nextChild(frame) {
  const raw = frame.raw;
  switch (frame.kind) {
    case 0 /* Array */:
      while (frame.next < raw.length) {
        const index = frame.next++;
        const child = raw[index];
        if (isObject2(child)) {
          frame.childKey = index;
          return child;
        }
      }
      return;
    case 1 /* Map */:
      for (;; ) {
        const step = frame.entries.next();
        if (step.done)
          return;
        const child = step.value[1];
        if (isObject2(child)) {
          frame.childKey = step.value[0];
          return child;
        }
      }
    case 2 /* Set */:
      for (;; ) {
        const step = frame.entries.next();
        if (step.done)
          return;
        if (isObject2(step.value)) {
          frame.childKey = undefined;
          return step.value;
        }
      }
    case 3 /* Object */: {
      const keys = frame.keys;
      while (frame.next < keys.length) {
        const key = keys[frame.next++];
        const child = raw[key];
        if (isObject2(child)) {
          frame.childKey = key;
          return child;
        }
      }
      return;
    }
    default:
      return;
  }
}
function enterAdopt(raw, key, walk, frames) {
  let node = nodes.get(raw);
  if (node !== undefined) {
    if (node.walk === walk.id)
      return node;
    node.walk = walk.id;
    if (!node.lostLink && walk.revisit?.has(raw) !== true) {
      if (attachedBefore(node, walk.former))
        return node;
      if (walk.aliases === undefined)
        (walk.created ??= new Set).add(raw);
    }
    if (node.lostLink)
      walk.relinked.push(node);
    frames.push(adoptFrame(raw, node, false, key));
    return node;
  }
  if (raw["__v_skip" /* SKIP */])
    return;
  if (raw["__v_isReactive" /* IS_REACTIVE */]) {
    const target = toRaw(raw);
    if (frames.length > 0)
      storeRaw(frames[frames.length - 1], key, raw, target);
    return enterAdopt(target, key, walk, frames);
  }
  const seen = walk.seen;
  const size = seen.size;
  seen.add(raw);
  if (seen.size === size) {
    (walk.repeated ??= new Set).add(raw);
    return;
  }
  if (walk.aliases?.has(raw))
    node = walkNode(raw, walk);
  if (walk.held?.has(raw))
    return node;
  frames.push(adoptFrame(raw, node, true, key));
  return node;
}
function walkNode(raw, walk) {
  const node = ensureLocationNode(raw);
  node.walk = walk.id;
  return node;
}
function storeRaw(frame, key, proxy, target) {
  const container = frame.raw;
  switch (frame.kind) {
    case 1 /* Map */:
      Map.prototype.set.call(container, key, target);
      return;
    case 2 /* Set */:
      (frame.swaps ??= new Map).set(proxy, target);
      return;
    default: {
      const descriptor = Reflect.getOwnPropertyDescriptor(container, key);
      if (descriptor !== undefined && descriptor.value === proxy)
        Reflect.set(container, key, target);
    }
  }
}
function swapMembers(set, swaps) {
  const members = Array.from(Set.prototype.values.call(set));
  Set.prototype.clear.call(set);
  for (let i = 0;i < members.length; i++) {
    const member = members[i];
    Set.prototype.add.call(set, isObject2(member) && swaps.get(member) || member);
  }
}
function placeChild(frame, key, childNode, walk) {
  if (childNode === undefined)
    return;
  const parent = frame.node ??= walkNode(frame.raw, walk);
  if (parent.id < walk.firstId && childNode.id < walk.firstId) {
    if (walk.aliases !== undefined && !walk.aliases.has(childNode.raw))
      return;
    if (!addPlace(childNode, parent, key))
      return;
  } else {
    pushPlace(childNode, new Place(parent, key));
  }
  touch(childNode, walk.store, walk.touched);
}
function touch(node, store, touched) {
  if (node.touched === store)
    return;
  node.touched = store;
  touched.push(node);
}
var stamps = 0;
function walkFrames(frames, walk) {
  for (;; ) {
    const frame = frames[frames.length - 1];
    const child = nextChild(frame);
    if (child !== undefined) {
      const depth = frames.length;
      const childNode = enterAdopt(child, frame.childKey, walk, frames);
      if (frames.length === depth)
        placeChild(frame, frame.childKey, childNode, walk);
      continue;
    }
    frames.pop();
    if (frame.swaps !== undefined)
      swapMembers(frame.raw, frame.swaps);
    const node = frame.node;
    if (frame.unknown && node !== undefined && walk.aliases === undefined)
      (walk.created ??= new Set).add(frame.raw);
    if (frames.length === 0)
      return node;
    placeChild(frames[frames.length - 1], frame.key, node, walk);
  }
}
function adopt(raw, walk) {
  const frames = [];
  const node = enterAdopt(raw, undefined, walk, frames);
  return frames.length === 0 ? node : walkFrames(frames, walk);
}
function adoptAll(touched, store, former, held, visit) {
  let walk = newWalk(touched, store, former, held);
  visit(walk);
  if (walk.repeated !== undefined) {
    const first = walk;
    walk = newWalk(touched, store, former, held, first);
    visit(walk);
    for (let i = 0;i < first.relinked.length; i++)
      first.relinked[i].lostLink = false;
  }
  for (let i = 0;i < walk.relinked.length; i++)
    walk.relinked[i].lostLink = false;
}
function pruneTouched(touched) {
  for (let i = 0;i < touched.length; i++) {
    if (touched[i].places.length > 1)
      prunePlaces(touched[i]);
  }
}
function hasObjectChild(raw) {
  if (Array.isArray(raw)) {
    for (let i = 0;i < raw.length; i++)
      if (isObject2(raw[i]))
        return true;
    return false;
  }
  if (Object.getPrototypeOf(raw) !== Object.prototype) {
    if (raw instanceof Map || raw instanceof Set) {
      const entries = raw instanceof Map ? Map.prototype.values.call(raw) : Set.prototype.values.call(raw);
      for (const child of entries)
        if (isObject2(child))
          return true;
      return false;
    }
    if (raw instanceof Date || ArrayBuffer.isView(raw))
      return false;
  }
  for (const key in raw) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && isObject2(raw[key]))
      return true;
  }
  return false;
}
function insertedNeedWalk(inserted) {
  let fresh;
  for (let i = 0;i < inserted.length; i++) {
    const value = inserted[i];
    if (!isObject2(value))
      continue;
    const node = nodes.get(value);
    if (node !== undefined) {
      if (node.lostLink || !attachedBefore(node, undefined))
        return true;
      continue;
    }
    if (hasObjectChild(value))
      return true;
    if (inserted.length > 1) {
      if (fresh === undefined)
        fresh = new Set;
      else if (fresh.has(value))
        return true;
      fresh.add(value);
    }
  }
  return false;
}
function heldBefore(value, replaced) {
  if (!Array.isArray(value) || !Array.isArray(replaced))
    return;
  let before;
  for (let i = 0;i < value.length; i++) {
    const item = value[i];
    if (!isObject2(item) || nodes.get(item) !== undefined)
      continue;
    if (before === undefined) {
      if (replaced.indexOf(item) === -1)
        return;
      before = new Set;
      for (let j = 0;j < replaced.length; j++)
        if (isObject2(replaced[j]))
          before.add(replaced[j]);
    }
    if (!before.has(item))
      return;
  }
  return before;
}
function heldItems(value, replaced) {
  if (!isObject2(value) || !isObject2(replaced) || nodes.get(replaced) === undefined)
    return;
  return heldBefore(value, replaced);
}
function attachValue(value, parent, key, fresh, replaced, held) {
  if (fresh)
    return;
  const former = isObject2(replaced) ? nodes.get(replaced) : undefined;
  const existing = nodes.get(value);
  if (existing !== undefined && !existing.lostLink && attachedBefore(existing, former)) {
    if (addPlace(existing, parent, key) && existing.places.length > 1)
      prunePlaces(existing);
    return;
  }
  if (existing === undefined && !hasObjectChild(value))
    return;
  const touched = [];
  const store = ++stamps;
  adoptAll(touched, store, former, held, (walk) => {
    const node = adopt(value, walk);
    if (node !== undefined && addPlace(node, parent, key))
      touch(node, store, touched);
  });
  pruneTouched(touched);
}
function adoptRoot(node) {
  const touched = [];
  adoptAll(touched, ++stamps, undefined, undefined, (walk) => {
    node.walk = walk.id;
    walkFrames([adoptFrame(node.raw, node, false, undefined)], walk);
  });
  pruneTouched(touched);
}
function relinkArray(arrayNode, array, from, removed, inserted, insertedFresh = false) {
  if (insertedFresh)
    inserted = undefined;
  relink(arrayNode, array, from, removed, inserted, false);
}
function relinkReorder(arrayNode, array, removed, inserted) {
  relink(arrayNode, array, 0, removed, inserted, true);
}
function relink(arrayNode, array, from, removed, inserted, findAliases) {
  const touched = [];
  const store = ++stamps;
  if (inserted !== undefined && insertedNeedWalk(inserted)) {
    adoptAll(touched, store, undefined, undefined, (walk) => {
      for (let i = 0;i < inserted.length; i++) {
        const value = inserted[i];
        if (isObject2(value))
          adopt(value, walk);
      }
    });
  }
  let removedNode = false;
  if (removed !== undefined) {
    for (let i = 0;i < removed.length; i++) {
      const value = removed[i];
      if (isObject2(value)) {
        const node = nodes.get(value);
        if (node !== undefined) {
          stripIndexes(node, arrayNode, from);
          removedNode = true;
        }
      }
    }
  }
  const call = ++relinkCalls;
  let firstIndex;
  let left = findAliases || removedNode || holdsNode(inserted) ? Infinity : arrayNode.childPlaces;
  for (let i = from;i < array.length && left > 0; i++) {
    const value = array[i];
    if (!isObject2(value))
      continue;
    let node = nodes.get(value);
    if (node === undefined) {
      if (!findAliases)
        continue;
      const first = (firstIndex ??= new Map).get(value);
      if (first === undefined) {
        firstIndex.set(value, i);
        continue;
      }
      if (value["__v_skip" /* SKIP */])
        continue;
      node = ensureLocationNode(value);
      node.relinked = call;
      node.relinkedPlaces = 0;
      node.places.push(new Place(arrayNode, first));
    } else if (node.relinked !== call) {
      node.relinked = call;
      const places = node.places;
      if (places.length === 1 && places[0].parentId === arrayNode.id && typeof places[0].key === "number" && places[0].key >= from) {
        places[0].key = i;
        node.relinkedPlaces = 0;
        left--;
        continue;
      }
      node.relinkedPlaces = stripIndexes(node, arrayNode, from);
    }
    if (node.relinkedPlaces > 0) {
      node.relinkedPlaces--;
      left--;
    }
    node.places.push(new Place(arrayNode, i));
    if (node.places.length > 1)
      touch(node, store, touched);
  }
  pruneTouched(touched);
}
var relinkCalls = 0;
function holdsNode(values) {
  if (values === undefined)
    return false;
  for (let i = 0;i < values.length; i++) {
    const value = values[i];
    if (isObject2(value) && nodes.get(value) !== undefined)
      return true;
  }
  return false;
}
function stripIndexes(node, arrayNode, from) {
  const places = node.places;
  let count = 0;
  for (let i = places.length - 1;i >= 0; i--) {
    const place = places[i];
    if (place.parentId === arrayNode.id && typeof place.key === "number" && place.key >= from) {
      arrayNode.childPlaces--;
      places.splice(i, 1);
      count++;
    }
  }
  if (count > 0)
    node.index = undefined;
  return count;
}
function evictDeep(value, parent) {
  if (value == null || typeof value !== "object")
    return;
  const top = toRaw(value);
  if (globalSeen.get(top) === undefined)
    return;
  const pending = [parent, undefined, top];
  while (pending.length > 0) {
    const raw = pending.pop();
    const key = pending.pop();
    const container = pending.pop();
    const proxy = globalSeen.get(raw);
    if (proxy === undefined)
      continue;
    const node = nodes.get(raw);
    if (node !== undefined) {
      const places = node.places;
      const onlyUnderParent = container !== undefined && node.root === undefined && places.length === 1 && places[0].parentId === container.id;
      if (!onlyUnderParent) {
        if (container !== undefined && places.length > 1 && removePlace(node, container, key))
          markLostLink(container);
        if (isAttached(node))
          continue;
      }
      node.proxy = undefined;
      node.evicted = new WeakRef(proxy);
    }
    globalSeen.delete(raw);
    wrapperCache.delete(raw);
    proxyStats.staleEvicted++;
    if (Array.isArray(raw)) {
      for (let i = 0;i < raw.length; i++)
        pushProxied(raw[i], node, i, pending);
    } else if (raw instanceof Map) {
      Map.prototype.forEach.call(raw, (child, key2) => pushProxied(child, node, key2, pending));
    } else if (raw instanceof Set) {
      for (const child of Set.prototype.values.call(raw))
        pushProxied(child, node, undefined, pending);
    } else {
      const keys = Object.keys(raw);
      for (let i = 0;i < keys.length; i++)
        pushProxied(raw[keys[i]], node, keys[i], pending);
    }
  }
}
function pushProxied(value, container, key, pending) {
  if (value === null || typeof value !== "object")
    return;
  const raw = toRaw(value);
  if (globalSeen.get(raw) !== undefined)
    pending.push(container, key, raw);
}
function restoreEvicted(node) {
  const proxy = node.evicted?.deref();
  node.evicted = undefined;
  if (proxy === undefined)
    return;
  node.proxy = proxy;
  globalSeen.set(node.raw, proxy);
  wrapperCache.set(node.raw, proxy);
  proxyStats.staleEvicted--;
  return proxy;
}

// src/watch-effect.ts
var activeEffect = null;
var queuedEffects = new Map;
var isFlushing = false;
var currentTriggerDepth = 0;
function setActiveEffect(effect) {
  activeEffect = effect;
}
var targetMap = new WeakMap;
function cleanupEffect(effect) {
  if (effect.dependencies) {
    effect.dependencies.forEach((dep) => {
      dep.delete(effect);
    });
    effect.dependencies.clear();
  }
}
function runCleanupFunctions(effect) {
  if (effect.cleanupFns && effect.cleanupFns.length > 0) {
    effect.cleanupFns.forEach((cleanupFn) => {
      try {
        cleanupFn();
      } catch (error) {
        console.error("Error in effect cleanup function:", error);
      }
    });
    effect.cleanupFns = [];
  }
}
function track(target, key) {
  if (!activeEffect || !activeEffect.active)
    return;
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map;
    targetMap.set(target, depsMap);
  }
  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set;
    depsMap.set(key, dep);
  }
  const effectToAdd = activeEffect;
  if (!dep.has(effectToAdd)) {
    dep.add(effectToAdd);
    if (!effectToAdd.dependencies) {
      effectToAdd.dependencies = new Set;
    }
    effectToAdd.dependencies.add(dep);
    if (effectToAdd.options?.onTrack) {
      effectToAdd.options.onTrack({ effect: effectToAdd._rawCallback, target, key, type: "track" });
    }
  }
}
function flushEffects() {
  if (isFlushing)
    return;
  isFlushing = true;
  try {
    let minDepth = Infinity;
    for (const depth of queuedEffects.values()) {
      if (depth < minDepth)
        minDepth = depth;
    }
    const effectsToRun = [];
    for (const [effect, depth] of queuedEffects.entries()) {
      if (depth === minDepth) {
        effectsToRun.push(effect);
        queuedEffects.delete(effect);
      }
    }
    for (const effect of effectsToRun) {
      if (!effect.active)
        continue;
      if (effect.options?.scheduler) {
        effect.options.scheduler(effect.run);
      }
    }
    for (const effect of effectsToRun) {
      if (!effect.active)
        continue;
      if (!effect.options?.scheduler) {
        effect.run();
      }
    }
  } finally {
    isFlushing = false;
    if (queuedEffects.size > 0) {
      flushEffects();
    }
  }
}
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap)
    return;
  currentTriggerDepth++;
  const triggerLevel = currentTriggerDepth;
  try {
    const addEffects = (depKey) => {
      const dep = depsMap.get(depKey);
      if (dep) {
        dep.forEach((effect) => {
          if (effect !== activeEffect && effect.active) {
            if (effect.options?.onTrigger) {
              effect.options.onTrigger({ effect: effect._rawCallback, target, key, type: "trigger" });
            }
            if (!queuedEffects.has(effect) || triggerLevel < queuedEffects.get(effect)) {
              queuedEffects.set(effect, triggerLevel);
            }
          }
        });
      }
    };
    addEffects(key);
    if (queuedEffects.size > 0) {
      flushEffects();
    }
  } finally {
    currentTriggerDepth--;
  }
}
function watchEffect(effectCallback, options = {}) {
  const run = () => {
    if (!effectFn.active) {
      throw new Error("Trying to run a stopped effect");
    }
    const previousEffect = activeEffect;
    try {
      runCleanupFunctions(effectFn);
      cleanupEffect(effectFn);
      setActiveEffect(effectFn);
      const onCleanup = (cleanupFn) => {
        if (!effectFn.cleanupFns) {
          effectFn.cleanupFns = [];
        }
        effectFn.cleanupFns.push(cleanupFn);
      };
      return effectCallback(onCleanup);
    } finally {
      setActiveEffect(previousEffect);
    }
  };
  const effectFn = {
    run,
    dependencies: new Set,
    options,
    active: true,
    _rawCallback: effectCallback,
    cleanupFns: []
  };
  if (!options.lazy) {
    effectFn.run();
  }
  const stopHandle = () => {
    if (effectFn.active) {
      runCleanupFunctions(effectFn);
      cleanupEffect(effectFn);
      effectFn.active = false;
      queuedEffects.delete(effectFn);
    }
  };
  stopHandle.effect = effectFn;
  return stopHandle;
}

// src/wrap-array.ts
function isObject3(v) {
  return v && typeof v === "object";
}
function arrayIndex(prop) {
  if (typeof prop !== "string" || prop.length === 0 || prop.length > 10)
    return -1;
  const first = prop.charCodeAt(0);
  if (first < 48 || first > 57 || first === 48 && prop.length > 1)
    return -1;
  for (let i = 1;i < prop.length; i++) {
    const code = prop.charCodeAt(i);
    if (code < 48 || code > 57)
      return -1;
  }
  const index = Number(prop);
  return index < 4294967295 ? index : -1;
}
function placeKey(prop) {
  const index = arrayIndex(prop);
  return index >= 0 ? index : prop;
}
function toIntegerOrInfinity(value) {
  const number = +value;
  if (number !== number || number === 0)
    return 0;
  return Math.trunc(number);
}
function clampIndex(relative, length) {
  return relative < 0 ? Math.max(length + relative, 0) : Math.min(relative, length);
}
function unwrapItems(items) {
  for (let i = 0;i < items.length; i++) {
    if (isObject3(items[i]))
      items[i] = unwrapForStore(items[i]);
  }
}
function planReorder(target, prop, method, args) {
  const length = target.length;
  if (prop === "fill" || prop === "copyWithin") {
    const fill2 = prop === "fill";
    const to = fill2 ? 0 : clampIndex(toIntegerOrInfinity(args[0]), length);
    const start = clampIndex(toIntegerOrInfinity(args[1]), length);
    const end = args[2] === undefined ? length : clampIndex(toIntegerOrInfinity(args[2]), length);
    const after2 = target.slice();
    method.call(after2, fill2 ? args[0] : to, start, end);
    const size = after2.length;
    if (fill2)
      return { after: after2, first: Math.min(start, size), last: Math.min(end, size), skip: -1 };
    const from = Math.min(to, size);
    const count = Math.min(Math.min(end, size) - Math.min(start, size), size - from);
    return { after: after2, first: from, last: from + Math.max(count, 0), skip: -1 };
  }
  const after = target.slice();
  method.apply(after, args);
  if (prop === "reverse") {
    return { after, first: 0, last: length, skip: length % 2 === 1 ? (length - 1) / 2 : -1 };
  }
  const sorted = length < 2 ? 0 : length;
  for (let i = length;i < target.length; i++) {
    if (i in target)
      after[i] = target[i];
    else
      after.length = i + 1;
  }
  return { after, first: 0, last: sorted, skip: -1 };
}
var strictWrites = function() {
  return this === undefined;
}();
function checkReorder(target, reorder) {
  const { after, first, last, skip } = reorder;
  let extensible;
  for (let i = first;i < last; i++) {
    if (i === skip)
      continue;
    if (i in after) {
      if (i in target) {
        if (strictWrites)
          target[i] = target[i];
        else if (!Reflect.set(target, i, target[i]))
          throw new TypeError(`Cannot assign to read only property '${i}' of array`);
      } else if (!(extensible ??= Object.isExtensible(target))) {
        throw new TypeError(`Cannot add property ${i}, array is not extensible`);
      }
    } else if (i in target && !Reflect.getOwnPropertyDescriptor(target, i).configurable) {
      throw new TypeError(`Cannot delete property '${i}' of array`);
    }
  }
}
function reorderChanges(target, after) {
  if (after.length !== target.length)
    return true;
  for (let i = 0;i < after.length; i++) {
    const value = after[i];
    const current = target[i];
    if (value !== current) {
      if (value === value || current === current)
        return true;
    } else if (value === 0) {
      if (1 / value !== 1 / current)
        return true;
    } else if (value === undefined && i in after !== i in target) {
      return true;
    }
  }
  return false;
}
function writeReorder(target, reorder) {
  const { after, first, last, skip } = reorder;
  for (let i = first;i < last; i++) {
    if (i === skip)
      continue;
    if (i in after)
      target[i] = after[i];
    else
      delete target[i];
  }
}
function evictRemoved(removed) {
  for (let i = 0;i < removed.length; i++) {
    if (isObject3(removed[i]))
      evictDeep(removed[i]);
  }
}
function wrapArray(arr, node) {
  const cachedProxy = wrapperCache.get(arr);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(arr))
    return globalSeen.get(arr);
  const methodCache = {};
  const proxy = new Proxy(arr, {
    get(target, prop, receiver) {
      if (prop === "__v_raw" /* RAW */)
        return target;
      if (prop === "__v_isReactive" /* IS_REACTIVE */)
        return true;
      track(target, prop);
      if (methodCache[prop]) {
        return methodCache[prop];
      }
      switch (prop) {
        case "sort":
        case "reverse":
        case "fill":
        case "copyWithin": {
          track(target, "length");
          const method = Array.prototype[prop];
          methodCache[prop] = function(...args) {
            if (prop === "fill" && isObject3(args[0]))
              args[0] = unwrapForStore(args[0]);
            const reorder = planReorder(target, prop, method, args);
            const before = target.slice();
            checkReorder(target, reorder);
            const after = reorder.after;
            if (!reorderChanges(target, after))
              return proxy;
            const located = locate(node);
            const event = located && {
              action: "replace",
              path: located.paths[0],
              oldValue: before,
              newValue: target
            };
            if (event !== undefined)
              copyPayloadAfter(event, located, target, after);
            writeReorder(target, reorder);
            relinkReorder(node, target, before, prop === "fill" ? [args[0]] : undefined);
            if (event !== undefined)
              dispatch(located, event);
            trigger(target, Symbol.iterator);
            evictRemoved(before);
            return proxy;
          };
          return methodCache[prop];
        }
        case "push":
          track(target, "length");
          methodCache[prop] = function(...items) {
            unwrapItems(items);
            const oldLength = target.length;
            const located = items.length > 0 ? locate(node) : undefined;
            const event = located && {
              action: "array-push",
              path: located.paths[0],
              key: oldLength,
              items
            };
            const copied = copyPayload(event, located, target);
            if (copied === 0 /* Reaches */) {
              const after = target.slice();
              after.push(...items);
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.push(...items);
            const newLength = target.length;
            if (items.length > 0) {
              relinkArray(node, target, oldLength, undefined, items, copied === 2 /* Fresh */);
              if (event !== undefined)
                dispatch(located, event);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return result;
          };
          return methodCache[prop];
        case "pop":
          track(target, "length");
          methodCache[prop] = function() {
            if (target.length === 0)
              return;
            const oldLength = target.length;
            const poppedIndex = oldLength - 1;
            const oldValue = target[poppedIndex];
            const located = locate(node);
            const event = located && {
              action: "array-pop",
              path: located.paths[0],
              key: poppedIndex,
              oldValue
            };
            if (copyPayload(event, located, target) === 0 /* Reaches */) {
              const after = target.slice();
              after.pop();
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.pop();
            const newLength = target.length;
            if (isObject3(oldValue))
              detachPlace(oldValue, node, poppedIndex);
            if (event !== undefined)
              dispatch(located, event);
            if (isObject3(oldValue))
              evictDeep(oldValue);
            trigger(target, Symbol.iterator);
            if (oldLength !== newLength) {
              trigger(target, "length");
            }
            return result;
          };
          return methodCache[prop];
        case "shift":
          track(target, "length");
          methodCache[prop] = function() {
            if (target.length === 0)
              return;
            const oldLength = target.length;
            const oldValue = target[0];
            const located = locate(node);
            const event = located && {
              action: "array-shift",
              path: located.paths[0],
              key: 0,
              oldValue
            };
            if (copyPayload(event, located, target) === 0 /* Reaches */) {
              const after = target.slice();
              after.shift();
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.shift();
            const newLength = target.length;
            relinkArray(node, target, 0, [oldValue]);
            if (event !== undefined)
              dispatch(located, event);
            if (isObject3(oldValue))
              evictDeep(oldValue);
            trigger(target, Symbol.iterator);
            if (oldLength !== newLength) {
              trigger(target, "length");
            }
            return result;
          };
          return methodCache[prop];
        case "unshift":
          track(target, "length");
          methodCache[prop] = function(...items) {
            unwrapItems(items);
            const oldLength = target.length;
            const located = items.length > 0 ? locate(node) : undefined;
            const event = located && {
              action: "array-unshift",
              path: located.paths[0],
              key: 0,
              items
            };
            const copied = copyPayload(event, located, target);
            if (copied === 0 /* Reaches */) {
              const after = target.slice();
              after.unshift(...items);
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.unshift(...items);
            const newLength = target.length;
            if (items.length > 0) {
              relinkArray(node, target, 0, undefined, items, copied === 2 /* Fresh */);
              if (event !== undefined)
                dispatch(located, event);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return result;
          };
          return methodCache[prop];
        case "splice":
          track(target, "length");
          methodCache[prop] = function(...args) {
            const oldLength = target.length;
            const actualStart = args.length === 0 ? 0 : clampIndex(toIntegerOrInfinity(args[0]), oldLength);
            const actualDeleteCount = args.length === 0 ? 0 : args.length === 1 ? oldLength - actualStart : Math.min(Math.max(toIntegerOrInfinity(args[1]), 0), oldLength - actualStart);
            const items = args.length > 2 ? args.slice(2) : [];
            unwrapItems(items);
            const changes = actualDeleteCount > 0 || items.length > 0;
            const located = changes ? locate(node) : undefined;
            const event = located && {
              action: "array-splice",
              path: located.paths[0],
              key: actualStart,
              deleteCount: actualDeleteCount,
              items: items.length > 0 ? items : undefined,
              oldValues: actualDeleteCount > 0 ? target.slice(actualStart, actualStart + actualDeleteCount) : undefined
            };
            const copied = copyPayload(event, located, target);
            if (copied === 0 /* Reaches */) {
              const after = target.slice();
              after.splice(actualStart, actualDeleteCount, ...items);
              copyPayloadReaching(event, located, target, after);
            }
            const deletedItems = target.splice(actualStart, actualDeleteCount, ...items);
            const newLength = target.length;
            if (changes) {
              relinkArray(node, target, actualStart, deletedItems, items, copied === 2 /* Fresh */);
              if (event !== undefined)
                dispatch(located, event);
              evictRemoved(deletedItems);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return deletedItems;
          };
          return methodCache[prop];
        case "find": {
          track(target, Symbol.iterator);
          if (!methodCache[prop]) {
            methodCache[prop] = function(predicate, thisArg) {
              const idx = Array.prototype.findIndex.call(target, predicate, thisArg);
              if (idx === -1)
                return;
              const value2 = target[idx];
              if (!isObject3(value2))
                return value2;
              return wrapChild(value2, node, idx);
            };
          }
          return methodCache[prop];
        }
        case "at": {
          track(target, Symbol.iterator);
          if (!methodCache[prop]) {
            methodCache[prop] = function(index2) {
              let idx = Number(index2);
              if (!Number.isInteger(idx))
                idx = Math.trunc(idx);
              if (idx < 0)
                idx = target.length + idx;
              if (idx < 0 || idx >= target.length)
                return;
              const value2 = target[idx];
              if (!isObject3(value2))
                return value2;
              return wrapChild(value2, node, idx);
            };
          }
          return methodCache[prop];
        }
        case Symbol.iterator:
        case "values":
        case "keys":
        case "entries":
        case "forEach":
        case "map":
        case "filter":
        case "reduce":
        case "reduceRight":
        case "findIndex":
        case "every":
        case "some":
        case "join":
          track(target, Symbol.iterator);
          break;
        case "length":
          track(target, "length");
          return Reflect.get(target, prop, receiver);
      }
      const value = Reflect.get(target, prop, receiver);
      const index = arrayIndex(prop);
      if (index >= 0) {
        track(target, prop);
        if (!isObject3(value))
          return value;
        return wrapChild(value, node, index);
      }
      const isNumericIndex = typeof prop === "string" && !isNaN(parseInt(prop, 10));
      if (isNumericIndex) {
        track(target, prop);
        if (!isObject3(value))
          return value;
        return wrapChild(value, node, placeKey(prop));
      }
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
    set(target, prop, value, receiver) {
      if (isObject3(value))
        value = unwrapForStore(value);
      const oldValue = target[prop];
      if (oldValue === value && Reflect.has(target, prop))
        return true;
      if (isObject3(oldValue) && isObject3(value) && deepEqual(oldValue, value))
        return true;
      const truncated = prop === "length" && Number(value) < target.length ? target.slice(Number(value)) : undefined;
      const isNumericIndex = typeof prop === "number" || arrayIndex(prop) >= 0 || typeof prop === "string" && !isNaN(parseInt(prop));
      const emits = isNumericIndex || prop === "length" || !writesThroughSetter(target, prop, node);
      const grows = prop === "length" && Number(value) > Number(oldValue);
      const located = emits ? grows ? locate(node) : locate(node, prop) : undefined;
      const event = located === undefined || grows ? undefined : { action: "set", path: located.paths[0], oldValue, newValue: value };
      const held = event !== undefined ? heldItems(value, oldValue) : undefined;
      const copied = copyPayload(event, located, target, held);
      if (copied === 0 /* Reaches */) {
        const after = target.slice();
        Reflect.set(after, prop, value);
        copyPayloadReaching(event, located, target, after);
      }
      const result = Reflect.set(target, prop, value, receiver);
      if (result && emits) {
        if (truncated !== undefined) {
          relinkArray(node, target, target.length, truncated);
        } else if (prop !== "length") {
          const key = placeKey(prop);
          if (isObject3(oldValue))
            detachPlace(oldValue, node, key);
          if (isObject3(value))
            attachValue(value, node, key, copied === 2 /* Fresh */, located && oldValue, held);
        }
        if (grows) {
          if (located !== undefined) {
            const oldLength = Number(oldValue);
            const newLength = Number(value);
            const events = [];
            for (let i = oldLength;i < newLength; i++) {
              const index = String(i);
              for (let j = 0;j < located.paths.length; j++) {
                events.push({ action: "set", path: [...located.paths[j], index], newValue: undefined });
              }
            }
            if (events.length > 0)
              deliver(located.root, events);
          }
        } else if (event !== undefined) {
          dispatch(located, event);
        }
        if (isObject3(oldValue) && oldValue !== value) {
          evictDeep(oldValue);
        }
        if (truncated !== undefined)
          evictRemoved(truncated);
        trigger(target, prop);
      }
      return result;
    },
    deleteProperty(target, prop) {
      const oldValue = target[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const located = hadProperty ? locate(node, prop) : undefined;
      const event = located && { action: "delete", path: located.paths[0], oldValue };
      if (copyPayload(event, located, target) === 0 /* Reaches */) {
        const after = target.slice();
        Reflect.deleteProperty(after, prop);
        copyPayloadReaching(event, located, target, after);
      }
      const result = Reflect.deleteProperty(target, prop);
      if (hadProperty && result) {
        if (isObject3(oldValue))
          detachPlace(oldValue, node, placeKey(prop));
        if (event !== undefined)
          dispatch(located, event);
        trigger(target, prop);
        if (isObject3(oldValue))
          evictDeep(oldValue);
      }
      return result;
    }
  });
  globalSeen.set(arr, proxy);
  wrapperCache.set(arr, proxy);
  proxyStats.created++;
  proxyStats.arrays++;
  return proxy;
}

// src/wrap-map.ts
function isObject4(value) {
  return value !== null && typeof value === "object";
}
function wrapMap(map, node) {
  const cachedProxy = wrapperCache.get(map);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(map))
    return globalSeen.get(map);
  const methodCache = {};
  const proxy = new Proxy(map, {
    get(target, prop, receiver) {
      if (prop === "__v_raw" /* RAW */)
        return target;
      if (prop === "__v_isReactive" /* IS_REACTIVE */)
        return true;
      track(target, prop);
      if (prop === Symbol.iterator || prop === "entries" || prop === "values" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
      }
      if (methodCache[prop]) {
        return methodCache[prop];
      }
      if (prop === "set") {
        methodCache[prop] = function(key, value2) {
          if (value2 != null && typeof value2 === "object")
            value2 = unwrapForStore(value2);
          const existed = target.has(key);
          const oldValue = target.get(key);
          const oldSize = target.size;
          if (oldValue === value2)
            return receiver;
          if (oldValue && typeof oldValue === "object" && value2 && typeof value2 === "object" && deepEqual(oldValue, value2))
            return receiver;
          const located = locate(node);
          const event = located && {
            action: "map-set",
            path: located.paths[0],
            key,
            oldValue,
            newValue: value2
          };
          const held = located && heldItems(value2, oldValue);
          if (event !== undefined && isObject4(key))
            event.key = nameKey(key, target, !existed);
          const copied = copyPayload(event, located, target, held);
          if (copied === 0 /* Reaches */) {
            copyPayloadReaching(event, located, target, shallowCopy(target).set(key, value2));
          }
          target.set(key, value2);
          const newSize = target.size;
          if (isObject4(oldValue))
            detachPlace(oldValue, node, key);
          if (isObject4(value2))
            attachValue(value2, node, key, copied === 2 /* Fresh */, located && oldValue, held);
          if (event !== undefined)
            dispatch(located, event);
          if (!existed) {
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
          } else {
            trigger(target, String(key));
          }
          if (isObject4(oldValue))
            evictDeep(oldValue);
          return receiver;
        };
        return methodCache[prop];
      }
      if (prop === "delete") {
        methodCache[prop] = function(key) {
          const existed = target.has(key);
          if (!existed)
            return false;
          const oldValue = target.get(key);
          const oldSize = target.size;
          const located = locate(node);
          const event = located && {
            action: "map-delete",
            path: located.paths[0],
            key,
            oldValue
          };
          if (event !== undefined && isObject4(key))
            event.key = nameKey(key, target, false);
          if (copyPayload(event, located, target) === 0 /* Reaches */) {
            const after = shallowCopy(target);
            after.delete(key);
            copyPayloadReaching(event, located, target, after);
          }
          const result = target.delete(key);
          const newSize = target.size;
          if (result) {
            if (isObject4(oldValue))
              detachPlace(oldValue, node, key);
            if (event !== undefined)
              dispatch(located, event);
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
            trigger(target, String(key));
            if (isObject4(oldValue))
              evictDeep(oldValue);
          }
          return result;
        };
        return methodCache[prop];
      }
      if (prop === "clear") {
        methodCache[prop] = function() {
          const oldSize = target.size;
          if (oldSize === 0)
            return;
          const removed = [...target];
          target.clear();
          const newSize = target.size;
          for (const [key, value2] of removed) {
            if (isObject4(value2))
              detachPlace(value2, node, key);
          }
          const located = locate(node);
          if (located !== undefined) {
            dispatch(located, {
              action: "map-clear",
              path: located.paths[0],
              key: null
            });
          }
          trigger(target, Symbol.iterator);
          if (oldSize !== newSize) {
            trigger(target, "size");
          }
          for (const [, value2] of removed) {
            if (isObject4(value2))
              evictDeep(value2);
          }
        };
        return methodCache[prop];
      }
      if (prop === "get") {
        methodCache[prop] = function(key) {
          track(target, String(key));
          const value2 = target.get(key);
          if (!value2 || typeof value2 !== "object")
            return value2;
          return wrapChild(value2, node, key);
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        track(target, Symbol.iterator);
        methodCache[prop] = function(key) {
          track(target, String(key));
          return target.has(key);
        }.bind(target);
        return methodCache[prop];
      }
      if (prop === Symbol.iterator || prop === "entries" || prop === "values" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
        if (prop === "forEach") {
          methodCache[prop] = (callbackfn, thisArg) => {
            const entriesIterator = proxy.entries();
            for (const [key, value2] of entriesIterator) {
              callbackfn.call(thisArg, value2, key, proxy);
            }
          };
          return methodCache[prop];
        }
        methodCache[prop] = function* () {
          for (const [key, value2] of target.entries()) {
            if (prop === "keys") {
              yield key;
              continue;
            }
            const wrappedValue = isObject4(value2) ? wrapChild(value2, node, key) : value2;
            if (prop === "values") {
              yield wrappedValue;
              continue;
            }
            yield [isObject4(key) ? wrapUnplaced(key) : key, wrappedValue];
          }
        };
        return methodCache[prop];
      }
      if (prop === "size") {
        track(target, "size");
        return target.size;
      }
      if (prop === "constructor") {
        return Map;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    }
  });
  globalSeen.set(map, proxy);
  wrapperCache.set(map, proxy);
  proxyStats.created++;
  proxyStats.maps++;
  return proxy;
}

// src/wrap-set.ts
function isObject5(value) {
  return value !== null && typeof value === "object";
}
function wrapSet(set, node) {
  const cachedProxy = wrapperCache.get(set);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(set))
    return globalSeen.get(set);
  const methodCache = {};
  const proxy = new Proxy(set, {
    get(target, prop, receiver) {
      if (prop === "__v_raw" /* RAW */)
        return target;
      if (prop === "__v_isReactive" /* IS_REACTIVE */)
        return true;
      track(target, prop);
      if (prop === Symbol.iterator || prop === "entries" || prop === "values" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
      }
      if (methodCache[prop]) {
        return methodCache[prop];
      }
      if (prop === "add") {
        methodCache[prop] = function(value2) {
          if (value2 != null && typeof value2 === "object")
            value2 = unwrapForStore(value2);
          const existed = target.has(value2);
          const oldSize = target.size;
          if (!existed) {
            const located = locate(node);
            const event = located && {
              action: "set-add",
              path: located.paths[0],
              value: value2
            };
            const copied = copyPayload(event, located, target);
            if (copied === 0 /* Reaches */) {
              copyPayloadReaching(event, located, target, shallowCopy(target).add(value2));
            }
            target.add(value2);
            const newSize = target.size;
            if (isObject5(value2))
              attachValue(value2, node, undefined, copied === 2 /* Fresh */);
            if (event !== undefined)
              dispatch(located, event);
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
          }
          return receiver;
        };
        return methodCache[prop];
      }
      if (prop === "delete") {
        methodCache[prop] = function(value2) {
          const existed = target.has(value2);
          const oldSize = target.size;
          if (existed) {
            const oldValue = value2;
            const located = locate(node);
            const event = located && {
              action: "set-delete",
              path: located.paths[0],
              value: value2,
              oldValue
            };
            if (copyPayload(event, located, target) === 0 /* Reaches */) {
              const after = shallowCopy(target);
              after.delete(value2);
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.delete(value2);
            const newSize = target.size;
            if (result) {
              if (isObject5(value2))
                detachPlace(value2, node, undefined);
              if (event !== undefined)
                dispatch(located, event);
              trigger(target, Symbol.iterator);
              if (oldSize !== newSize) {
                trigger(target, "size");
              }
              if (isObject5(value2))
                evictDeep(value2);
            }
            return result;
          }
          return false;
        };
        return methodCache[prop];
      }
      if (prop === "clear") {
        methodCache[prop] = function() {
          const oldSize = target.size;
          if (oldSize === 0)
            return;
          const removed = [...target];
          target.clear();
          const newSize = target.size;
          for (const member of removed) {
            if (isObject5(member))
              detachPlace(member, node, undefined);
          }
          const located = locate(node);
          if (located !== undefined) {
            dispatch(located, {
              action: "set-clear",
              path: located.paths[0],
              value: null
            });
          }
          trigger(target, Symbol.iterator);
          if (oldSize !== newSize) {
            trigger(target, "size");
          }
          for (const member of removed) {
            if (isObject5(member))
              evictDeep(member);
          }
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        track(target, Symbol.iterator);
        methodCache[prop] = function(value2) {
          if (typeof value2 === "string" || typeof value2 === "number" || typeof value2 === "symbol") {
            track(target, String(value2));
          }
          return target.has(value2);
        }.bind(target);
        return methodCache[prop];
      }
      if (prop === "values" || prop === Symbol.iterator || prop === "entries" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
        const originalMethod = Reflect.get(target, prop, receiver);
        if (prop === "forEach") {
          methodCache[prop] = (callbackfn, thisArg) => {
            const valuesIterator = proxy.values();
            for (const value2 of valuesIterator) {
              callbackfn.call(thisArg, value2, value2, proxy);
            }
          };
          return methodCache[prop];
        }
        methodCache[prop] = function* (...args) {
          let index = 0;
          const iterator = originalMethod.apply(target, args);
          for (const entry of iterator) {
            let valueToWrap = entry;
            if (prop === "entries") {
              valueToWrap = entry[1];
            }
            track(target, String(index));
            const wrappedValue = isObject5(valueToWrap) ? wrapChild(valueToWrap, node, undefined) : valueToWrap;
            if (prop === "entries") {
              yield [wrappedValue, wrappedValue];
            } else {
              yield wrappedValue;
            }
            index++;
          }
        };
        return methodCache[prop];
      }
      if (prop === "size") {
        track(target, "size");
        return target.size;
      }
      if (prop === "constructor") {
        return Set;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    }
  });
  globalSeen.set(set, proxy);
  wrapperCache.set(set, proxy);
  proxyStats.created++;
  proxyStats.sets++;
  return proxy;
}

// src/reactive.ts
function isObject6(v) {
  return v && typeof v === "object";
}
function isReactive(value) {
  return !!(value && value["__v_isReactive" /* IS_REACTIVE */]);
}
function createAsyncEmit(emit) {
  const queue = [];
  let flushScheduled = false;
  return (event) => {
    queue.push(event);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(() => {
        let failed = false;
        let failure;
        let next = 0;
        while (next < queue.length) {
          try {
            emit(queue[next++]);
          } catch (error) {
            if (!failed) {
              failed = true;
              failure = error;
            }
          }
          if (next === FLUSH_CHUNK) {
            queue.splice(0, next);
            next = 0;
          }
        }
        queue.length = 0;
        flushScheduled = false;
        if (failed)
          throw failure;
      });
    }
  };
}
var FLUSH_CHUNK = 1024;
function reactive(obj, emit, path = [], options) {
  if (obj["__v_skip" /* SKIP */]) {
    return obj;
  }
  const existing = globalSeen.get(obj);
  if (existing !== undefined)
    return existing;
  if (obj["__v_isReactive" /* IS_REACTIVE */])
    return obj;
  if (emit && path.length === 0 && options?.async) {
    emit = createAsyncEmit(emit);
  }
  let fresh = false;
  if (emit && path.length === 0) {
    try {
      const newValue = cloneStored(obj, undefined, 2 /* All */);
      fresh = copiedFresh;
      emit({ action: "replace", path: [], newValue });
    } catch (error) {
      if (error instanceof SnapshotLimitError)
        throw error;
      console.error("Failed to emit initial reactive state:", error);
    }
  }
  const node = ensureLocationNode(obj);
  node.root = { emit, path, async: emit !== undefined && options?.async === true, undelivered: undefined };
  node.scope = node.root;
  if (emit && !fresh)
    adoptRoot(node);
  return createProxy(obj, node, options);
}
function wrapChild(raw, parent, key, options) {
  let node = getLocationNode(raw);
  if (node !== undefined && node.proxy !== undefined) {
    notePlace(node, parent, key);
    node.scope ??= parent.scope;
    return node.proxy;
  }
  if (raw["__v_skip" /* SKIP */])
    return raw;
  if (raw["__v_isReactive" /* IS_REACTIVE */])
    return wrapChild(toRaw(raw), parent, key, options);
  if (raw instanceof Date)
    return new Date(raw.getTime());
  node ??= ensureLocationNode(raw);
  notePlace(node, parent, key);
  node.scope ??= parent.scope;
  return restoreEvicted(node) ?? createProxy(raw, node, options);
}
function wrapUnplaced(raw) {
  if (raw["__v_skip" /* SKIP */])
    return raw;
  const existing = globalSeen.get(raw);
  if (existing !== undefined)
    return existing;
  if (raw["__v_isReactive" /* IS_REACTIVE */])
    return wrapUnplaced(toRaw(raw));
  const node = ensureLocationNode(raw);
  return restoreEvicted(node) ?? createProxy(raw, node);
}
function createProxy(raw, node, options) {
  const proxy = Array.isArray(raw) ? wrapArray(raw, node) : raw instanceof Map ? wrapMap(raw, node) : raw instanceof Set ? wrapSet(raw, node) : wrapObject(raw, node, options);
  node.proxy = proxy;
  return proxy;
}
function wrapObject(obj, node, options) {
  const proxy = new Proxy(obj, {
    get(target, prop, receiver) {
      if (prop === "__v_raw" /* RAW */) {
        return target;
      }
      if (prop === "__v_isReactive" /* IS_REACTIVE */) {
        return true;
      }
      const value = Reflect.get(target, prop, receiver);
      track(target, prop);
      if (!isObject6(value))
        return value;
      return wrapChild(value, node, prop, options);
    },
    set(target, prop, value, receiver) {
      if (isObject6(value))
        value = unwrapForStore(value);
      const oldValue = target[prop];
      if (oldValue === value)
        return true;
      if (!options?.async && isObject6(oldValue) && isObject6(value) && deepEqual(oldValue, value))
        return true;
      const emits = !writesThroughSetter(target, prop, node);
      const located = emits ? locate(node, prop) : undefined;
      const event = located && {
        action: "set",
        path: located.paths[0],
        oldValue,
        newValue: value
      };
      const held = located && heldItems(value, oldValue);
      const copied = copyPayload(event, located, target, held);
      if (copied === 0 /* Reaches */) {
        const after = shallowCopy(target);
        const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
        if (descriptor === undefined || descriptor.enumerable)
          setData(after, prop, value);
        copyPayloadReaching(event, located, target, after);
      }
      const result = Reflect.set(target, prop, value, receiver);
      if (result && emits) {
        if (isObject6(oldValue))
          detachPlace(oldValue, node, prop);
        if (isObject6(value))
          attachValue(value, node, prop, copied === 2 /* Fresh */, located && oldValue, held);
        if (event !== undefined)
          dispatch(located, event);
        trigger(target, prop);
        if (isObject6(oldValue)) {
          evictDeep(oldValue);
        }
      }
      return result;
    },
    deleteProperty(target, prop) {
      const oldValue = target[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const located = hadProperty ? locate(node, prop) : undefined;
      const event = located && {
        action: "delete",
        path: located.paths[0],
        oldValue
      };
      if (copyPayload(event, located, target) === 0 /* Reaches */) {
        const after = shallowCopy(target);
        delete after[prop];
        copyPayloadReaching(event, located, target, after);
      }
      const result = Reflect.deleteProperty(target, prop);
      if (hadProperty && result) {
        if (isObject6(oldValue))
          detachPlace(oldValue, node, prop);
        if (event !== undefined)
          dispatch(located, event);
        trigger(target, prop);
        if (isObject6(oldValue)) {
          evictDeep(oldValue);
        }
      }
      return result;
    }
  });
  globalSeen.set(obj, proxy);
  proxyStats.created++;
  proxyStats.objects++;
  return proxy;
}

// src/state.ts
function getValue(obj, key) {
  if (obj instanceof Map)
    return obj.get(key);
  return obj[key];
}
function setValue(obj, key, value) {
  if (obj instanceof Map)
    obj.set(key, value);
  else
    obj[key] = value;
}
function deleteValue(obj, key) {
  if (obj instanceof Map)
    obj.delete(key);
  else
    delete obj[key];
}
function validateCachedPath(root, fullPath, pathKey, cached) {
  if (fullPath.length === 0)
    return cached;
  const lastKey = fullPath[fullPath.length - 1];
  let grandparent = root;
  for (let i = 0;i < fullPath.length - 1; i++) {
    grandparent = grandparent ? getValue(grandparent, fullPath[i]) : undefined;
    if (grandparent === undefined)
      break;
  }
  if (grandparent === undefined) {
    evictDescendantsFromPathCache(root, pathKey);
    return;
  }
  const actual = getValue(grandparent, lastKey);
  if (actual === cached)
    return cached;
  evictDescendantsFromPathCache(root, pathKey);
  return;
}
var actionHandlers = {
  set: function(parent, key, event) {
    if (Array.isArray(parent) && key === "length" && Number(event.newValue) > parent.length) {
      console.warn(`refusing to grow array length via bare set at path ${event.path.join(".")}`);
      return;
    }
    setValue(parent, key, event.newValue);
  },
  delete: function(parent, key) {
    deleteValue(parent, key);
  },
  "array-push": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (!event.items) {
      console.warn("array-push event missing items");
      return;
    }
    targetArray.push(...event.items);
  },
  "array-pop": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (targetArray.length > 0) {
      targetArray.pop();
    }
  },
  "array-splice": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (event.key === undefined || event.deleteCount === undefined) {
      console.warn("array-splice event missing key or deletecount");
      return;
    }
    if (event.items && event.items.length > 0) {
      targetArray.splice(event.key, event.deleteCount, ...event.items);
    } else {
      targetArray.splice(event.key, event.deleteCount);
    }
  },
  "array-shift": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (targetArray.length > 0) {
      targetArray.shift();
    }
  },
  "array-unshift": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (!event.items) {
      console.warn("array-unshift event missing items");
      return;
    }
    targetArray.unshift(...event.items);
  },
  "map-set": function(targetMap2, _parentKeyIgnored, event) {
    if (!(targetMap2 instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    replicaMapSet(targetMap2, event.key, event.newValue);
  },
  "map-delete": function(targetMap2, _parentKeyIgnored, event) {
    if (!(targetMap2 instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    replicaMapDelete(targetMap2, event.key);
  },
  "map-clear": function(targetMap2, _parentKeyIgnored, event) {
    if (!(targetMap2 instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    targetMap2.clear();
    forgetReplicaIndex(targetMap2);
  },
  "set-add": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    replicaAdd(targetSet, event.value);
  },
  "set-delete": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    replicaDelete(targetSet, event.value);
  },
  "set-clear": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    targetSet.clear();
    forgetReplicaIndex(targetSet);
  },
  replace: function(target, _keyIgnored, event) {
    const newValue = event.newValue;
    if (newValue === undefined || newValue === null) {
      console.warn("replace action requires newValue");
      return;
    }
    if (Array.isArray(target) && Array.isArray(newValue)) {
      target.splice(0, target.length, ...newValue);
    } else if (target instanceof Map && newValue instanceof Map) {
      const newValueEntries = [...newValue.entries()];
      target.clear();
      forgetReplicaIndex(target);
      const reactiveTarget = isReactive(target);
      for (const [key, value] of newValueEntries) {
        if (reactiveTarget)
          replicaMapSet(target, key, value);
        else
          target.set(key, value);
      }
    } else if (target instanceof Set && newValue instanceof Set) {
      const newValueEntries = [...newValue.values()];
      target.clear();
      forgetReplicaIndex(target);
      const reactiveTarget = isReactive(target);
      for (const value of newValueEntries) {
        if (reactiveTarget)
          replicaAdd(target, value);
        else
          target.add(value);
      }
    } else if (typeof target === "object" && target !== null && typeof newValue === "object" && newValue !== null) {
      Object.keys(target).forEach((key) => delete target[key]);
      Object.assign(target, newValue);
    } else {
      console.warn(`Type mismatch or unsupported type for 'replace' action at path ${event.path.join(".")}. Target type: ${typeof target} ${target.constructor.name}, New value type: ${typeof newValue} ${newValue.constructor.name}`);
    }
  }
};
function updateState(root, event) {
  const { action, path } = event;
  if (!path || path.length === 0 && action !== "replace") {
    console.warn("event path is invalid for action", event);
    return;
  }
  const handler = actionHandlers[action];
  if (!handler) {
    console.error(`unhandled action type: ${action}`, event);
    return;
  }
  let targetForHandler;
  let keyForHandler = null;
  if (action === "set" || action === "delete") {
    if (path.length === 1) {
      targetForHandler = root;
      keyForHandler = path[0];
    } else {
      const parentPath = path.slice(0, -1);
      const parentPathKey = parentPath.join(".");
      let parent = pathCache.get(root)?.get(parentPathKey);
      if (parent !== undefined) {
        parent = validateCachedPath(root, parentPath, parentPathKey, parent);
      }
      if (parent === undefined) {
        parent = parentPath.reduce((acc, key) => acc ? getValue(acc, key) : undefined, root);
        if (parent !== undefined)
          setInPathCache(root, parentPathKey, parent);
      }
      if (parent === undefined) {
        console.warn(`parent path ${parentPathKey} not found for action ${action}`);
        return;
      }
      targetForHandler = parent;
      keyForHandler = path[path.length - 1];
    }
  } else if (action.startsWith("array-") || action.startsWith("map-") || action.startsWith("set-") || action === "replace") {
    if (path.length === 0 && action === "replace") {
      targetForHandler = root;
    } else {
      const targetPath = path;
      const targetPathKey = targetPath.join(".");
      let targetCollection = pathCache.get(root)?.get(targetPathKey);
      if (targetCollection !== undefined) {
        targetCollection = validateCachedPath(root, targetPath, targetPathKey, targetCollection);
      }
      if (targetCollection === undefined) {
        targetCollection = targetPath.reduce((acc, key) => acc ? getValue(acc, key) : undefined, root);
        if (targetCollection !== undefined)
          setInPathCache(root, targetPathKey, targetCollection);
      }
      if (targetCollection === undefined) {
        console.warn(`target at path ${targetPathKey} not found for action ${action}`);
        return;
      }
      targetForHandler = targetCollection;
    }
  } else {
    console.error(`unexpected action type passed checks: ${action}`);
    return;
  }
  handler(targetForHandler, keyForHandler, event);
  if (action === "set" && event.newValue != null && typeof event.newValue === "object") {
    const fullPathKey = path.join(".");
    evictDescendantsFromPathCache(root, fullPathKey);
  }
}
// src/ref.ts
var isRefSymbol = Symbol("isRef");
function ref(value) {
  return createRef(value);
}
function createRef(rawValue) {
  if (isRef(rawValue)) {
    return rawValue;
  }
  let _value = rawValue;
  const r = {
    [isRefSymbol]: true,
    get value() {
      track(r, "value");
      return _value;
    },
    set value(newValue) {
      if (_value !== newValue) {
        _value = newValue;
        trigger(r, "value");
      }
    }
  };
  return r;
}
function isRef(r) {
  return !!(r && r[isRefSymbol]);
}
function unref(refValue) {
  return isRef(refValue) ? refValue.value : refValue;
}
function toRefs(object) {
  const result = {};
  for (const key in object) {
    result[key] = toRef(object, key);
  }
  return result;
}
function toRef(object, key) {
  return {
    [isRefSymbol]: true,
    get value() {
      track(this, "value");
      return object[key];
    },
    set value(newVal) {
      object[key] = newVal;
    }
  };
}
function triggerRef(ref2) {
  trigger(ref2, "value");
}

// src/computed.ts
var isComputedSymbol = Symbol("isComputed");
function computed(getterOrOptions) {
  let getter;
  let setter;
  const isGetter = typeof getterOrOptions === "function";
  if (isGetter) {
    getter = getterOrOptions;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  let _value;
  let _dirty = true;
  let computedRef;
  const stopHandle = watchEffect(getter, {
    lazy: true,
    scheduler: () => {
      if (!_dirty) {
        _dirty = true;
        trigger(computedRef, "value");
      }
    }
  });
  const effectRunner = stopHandle.effect;
  computedRef = {
    [isRefSymbol]: true,
    [isComputedSymbol]: true,
    get value() {
      track(computedRef, "value");
      if (_dirty) {
        _value = effectRunner.run();
        _dirty = false;
      }
      return _value;
    },
    set value(newValue) {
      if (setter) {
        setter(newValue);
      } else {
        console.warn("computed value is read-only");
      }
    },
    stop: stopHandle
  };
  return computedRef;
}
function isComputed(c) {
  return !!(c && c[isComputedSymbol]);
}

// src/watch.ts
function watch(source, callback, options = {}) {
  const { immediate = false, deep = true } = options;
  const isMultiSource = Array.isArray(source);
  const getter = () => {
    if (isMultiSource) {
      return source.map((s) => {
        if (isRef(s))
          return s.value;
        if (isComputed(s))
          return s.value;
        if (typeof s === "function")
          return s();
        return s;
      });
    }
    if (isRef(source))
      return source.value;
    if (isComputed(source))
      return source.value;
    if (typeof source === "function")
      return source();
    return source;
  };
  let oldValue;
  let initialized = false;
  const stopEffect = watchEffect(() => {
    let currentValue = getter();
    if (deep) {
      traverse(currentValue);
    }
    const job = () => {
      if (initialized) {
        let hasChanged = false;
        if (isMultiSource) {
          if (!Array.isArray(oldValue) || currentValue.length !== oldValue.length) {
            hasChanged = true;
          } else {
            hasChanged = currentValue.some((val, i) => {
              return deep ? !deepEqual(val, oldValue[i]) : val !== oldValue[i];
            });
          }
        } else {
          hasChanged = deep ? !deepEqual(currentValue, oldValue) : currentValue !== oldValue;
        }
        if (hasChanged) {
          const prevOldValue = oldValue;
          if (isMultiSource) {
            currentValue = getter();
          }
          const valueToClone = currentValue && typeof currentValue === "object" && currentValue.__v_raw ? currentValue.__v_raw : currentValue;
          oldValue = deep ? deepClone(valueToClone) : currentValue;
          callback(currentValue, prevOldValue);
        }
      } else {
        const valueToClone = currentValue && typeof currentValue === "object" && currentValue.__v_raw ? currentValue.__v_raw : currentValue;
        oldValue = deep ? deepClone(valueToClone) : currentValue;
        initialized = true;
        if (immediate) {
          callback(currentValue, undefined);
        }
      }
    };
    job();
  });
  return stopEffect;
}
// src/mark-raw.ts
function markRaw(obj) {
  if (obj && typeof obj === "object") {
    Object.defineProperty(obj, "__v_skip" /* SKIP */, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  return obj;
}
// src/integrations/vue3.ts
var import_vue = require("vue");
var import_reactivity = __toESM(require_reactivity_cjs(), 1);
function trackVueReactiveEvents(vueState, emit, options = {}) {
  const { emitInitialReplace = true, onDiffError } = options;
  if (emitInitialReplace) {
    try {
      emit({ action: "replace", path: [], newValue: deepClone(vueState) });
    } catch (e) {}
  }
  const prev = {};
  const pathStack = [];
  const keyStops = new Map;
  let rootStop = null;
  for (const k of Object.keys(vueState)) {
    prev[k] = deepClone(vueState[k]);
  }
  function createKeyEffect(k) {
    const stop = import_vue.watchEffect(() => {
      if (!(k in vueState))
        return;
      const currVal = vueState[k];
      pathStack.push(k);
      try {
        const result = diffAndClone(currVal, prev[k], pathStack, emit);
        if (result !== prev[k]) {
          prev[k] = result;
        }
      } catch (e) {
        const errorPath = pathStack.slice();
        pathStack.length = 0;
        prev[k] = deepClone(vueState[k]);
        if (onDiffError) {
          onDiffError({ key: k, path: errorPath, error: e });
        }
        return;
      }
      pathStack.pop();
    }, { flush: "sync" });
    keyStops.set(k, stop);
  }
  function createRootEffect() {
    rootStop = import_vue.watchEffect(() => {
      const currKeys = Object.keys(vueState);
      const currKeySet = new Set(currKeys);
      const prevKeySet = new Set(Object.keys(prev));
      for (const k of currKeys) {
        if (!prevKeySet.has(k)) {
          import_reactivity.pauseTracking();
          const cloned = deepClone(vueState[k]);
          import_reactivity.resetTracking();
          pathStack.push(k);
          emit({ action: "set", path: pathStack.slice(), newValue: cloned });
          pathStack.pop();
          prev[k] = cloned;
          createKeyEffect(k);
        }
      }
      for (const k of prevKeySet) {
        if (!currKeySet.has(k)) {
          pathStack.push(k);
          emit({ action: "delete", path: pathStack.slice(), oldValue: prev[k] });
          pathStack.pop();
          delete prev[k];
          keyStops.get(k)?.();
          keyStops.delete(k);
        }
      }
    }, { flush: "sync" });
  }
  function stopAll() {
    rootStop?.();
    rootStop = null;
    for (const stop of keyStops.values())
      stop();
    keyStops.clear();
  }
  function startAll() {
    for (const k of Object.keys(prev)) {
      createKeyEffect(k);
    }
    createRootEffect();
  }
  startAll();
  return {
    stop: stopAll,
    pause: stopAll,
    resume() {
      const currentKeys = new Set(Object.keys(vueState));
      for (const k of Object.keys(prev)) {
        if (!currentKeys.has(k))
          delete prev[k];
      }
      for (const k of currentKeys) {
        prev[k] = deepClone(vueState[k]);
      }
      startAll();
    }
  };
}
function typeTag(v) {
  if (v === null || typeof v !== "object")
    return "primitive";
  if (Array.isArray(v))
    return "array";
  if (v instanceof Map)
    return "map";
  if (v instanceof Set)
    return "set";
  if (v instanceof Date)
    return "date";
  return "object";
}
function diffAndClone(curr, old, pathStack, emit) {
  if (curr === null || typeof curr !== "object") {
    if (curr !== old) {
      emit({ action: "set", path: pathStack.slice(), oldValue: old, newValue: curr });
    }
    return curr;
  }
  if (typeTag(curr) !== typeTag(old)) {
    emit({ action: "set", path: pathStack.slice(), oldValue: old, newValue: deepClone(curr) });
    return deepClone(curr);
  }
  if (curr instanceof Date) {
    if (!(old instanceof Date) || +curr !== +old) {
      emit({ action: "set", path: pathStack.slice(), oldValue: old, newValue: new Date(+curr) });
      return new Date(+curr);
    }
    return old;
  }
  if (Array.isArray(curr)) {
    return diffAndCloneArray(curr, old, pathStack, emit);
  }
  if (curr instanceof Map) {
    return diffAndCloneMap(curr, old, pathStack, emit);
  }
  if (curr instanceof Set) {
    return diffAndCloneSet(curr, old, pathStack, emit);
  }
  return diffAndCloneObject(curr, old, pathStack, emit);
}
function diffAndCloneObject(curr, old, pathStack, emit) {
  const currKeys = Object.keys(curr);
  const oldKeys = Object.keys(old);
  let changed = false;
  let result = null;
  for (let i = 0;i < oldKeys.length; i++) {
    const k = oldKeys[i];
    if (!(k in curr)) {
      if (!changed) {
        changed = true;
        result = { ...old };
      }
      pathStack.push(k);
      emit({ action: "delete", path: pathStack.slice(), oldValue: old[k] });
      pathStack.pop();
      delete result[k];
    }
  }
  for (let i = 0;i < currKeys.length; i++) {
    const k = currKeys[i];
    if (!(k in old)) {
      if (!changed) {
        changed = true;
        result = { ...old };
      }
      pathStack.push(k);
      emit({ action: "set", path: pathStack.slice(), newValue: deepClone(curr[k]) });
      pathStack.pop();
      result[k] = deepClone(curr[k]);
    } else {
      pathStack.push(k);
      const childResult = diffAndClone(curr[k], old[k], pathStack, emit);
      pathStack.pop();
      if (childResult !== old[k]) {
        if (!changed) {
          changed = true;
          result = { ...old };
        }
        result[k] = childResult;
      }
    }
  }
  return changed ? result : old;
}
function diffAndCloneArray(curr, old, pathStack, emit) {
  const min = Math.min(curr.length, old.length);
  let changed = false;
  let result = null;
  for (let i = 0;i < min; i++) {
    pathStack.push(i);
    const childResult = diffAndClone(curr[i], old[i], pathStack, emit);
    pathStack.pop();
    if (childResult !== old[i]) {
      if (!changed) {
        changed = true;
        result = old.slice();
      }
      result[i] = childResult;
    }
  }
  if (curr.length > old.length) {
    if (!changed) {
      changed = true;
      result = old.slice();
    }
    result.length = curr.length;
    for (let i = old.length;i < curr.length; i++) {
      pathStack.push(i);
      emit({ action: "set", path: pathStack.slice(), newValue: deepClone(curr[i]) });
      pathStack.pop();
      result[i] = deepClone(curr[i]);
    }
  } else if (curr.length < old.length) {
    if (!changed) {
      changed = true;
      result = old.slice();
    }
    pathStack.push("length");
    emit({ action: "set", path: pathStack.slice(), newValue: curr.length, oldValue: old.length });
    pathStack.pop();
    result.length = curr.length;
  }
  return changed ? result : old;
}
function diffAndCloneMap(curr, old, pathStack, emit) {
  let changed = false;
  let result = null;
  const path = pathStack.slice();
  for (const [k, v] of old.entries()) {
    if (!curr.has(k)) {
      if (!changed) {
        changed = true;
        result = new Map(old);
      }
      emit({ action: "map-delete", path, key: k, oldValue: v });
      result.delete(k);
    }
  }
  for (const [k, v] of curr.entries()) {
    const vClone = deepClone(v);
    if (!old.has(k)) {
      if (!changed) {
        changed = true;
        result = new Map(old);
      }
      emit({ action: "map-set", path, key: k, newValue: vClone });
      result.set(k, vClone);
    } else if (!deepEqual(vClone, old.get(k), new WeakMap)) {
      if (!changed) {
        changed = true;
        result = new Map(old);
      }
      emit({ action: "map-set", path, key: k, newValue: vClone, oldValue: old.get(k) });
      result.set(k, vClone);
    }
  }
  return changed ? result : old;
}
function diffAndCloneSet(curr, old, pathStack, emit) {
  let changed = false;
  let result = null;
  const path = pathStack.slice();
  for (const v of old.values()) {
    if (!curr.has(v)) {
      if (!changed) {
        changed = true;
        result = new Set(old);
      }
      emit({ action: "set-delete", path, value: v, oldValue: v });
      result.delete(v);
    }
  }
  for (const v of curr.values()) {
    if (!old.has(v)) {
      if (!changed) {
        changed = true;
        result = new Set(old);
      }
      emit({ action: "set-add", path, value: deepClone(v) });
      result.add(deepClone(v));
    }
  }
  return changed ? result : old;
}
// src/integrations/electron-bridge.ts
function makeTx() {
  try {
    const g = globalThis;
    if (g.crypto && typeof g.crypto.randomUUID === "function") {
      return g.crypto.randomUUID();
    }
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function createBridgeEmitter(opts) {
  const { id, apply, send, onMessage, forward, seenLimit = 1000 } = opts;
  let muteCount = 0;
  const mute = (fn) => {
    muteCount++;
    try {
      return fn();
    } finally {
      muteCount--;
    }
  };
  const seen = new Set;
  const order = [];
  const markSeen = (tx) => {
    if (seen.has(tx))
      return;
    seen.add(tx);
    order.push(tx);
    if (order.length > seenLimit) {
      const oldest = order.shift();
      seen.delete(oldest);
    }
  };
  const emit = (event) => {
    if (muteCount > 0)
      return;
    const msg = { tx: makeTx(), origin: id, event };
    markSeen(msg.tx);
    send(msg);
  };
  const unsubscribe = onMessage((msg, ctx) => {
    if (!msg || !msg.tx)
      return;
    if (seen.has(msg.tx))
      return;
    markSeen(msg.tx);
    if (msg.origin === id)
      return;
    mute(() => apply(msg.event));
    if (forward)
      forward(msg, ctx);
  });
  const stop = () => unsubscribe();
  return { emit, stop, mute };
}
function createRendererBridgeEmitter(opts) {
  const { id, channel, ipcRenderer, apply, seenLimit } = opts;
  return createBridgeEmitter({
    id,
    apply,
    seenLimit,
    send: (msg) => ipcRenderer.send(channel, msg),
    onMessage: (cb) => {
      const handler = (_e, msg) => cb(msg);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.off(channel, handler);
    }
  });
}
function createMainBridgeEmitter(opts) {
  const { id = "main", channel, ipcMain, windows, apply, seenLimit } = opts;
  const broadcast = (msg, exceptId) => {
    for (const w of windows()) {
      if (exceptId != null && w.webContents.id === exceptId)
        continue;
      w.webContents.send(channel, msg);
    }
  };
  return createBridgeEmitter({
    id,
    apply,
    seenLimit,
    send: (msg) => broadcast(msg),
    onMessage: (cb) => {
      const handler = (e, msg) => cb(msg, { senderId: e?.sender?.id });
      ipcMain.on(channel, handler);
      return () => ipcMain.off(channel, handler);
    },
    forward: (msg, ctx) => broadcast(msg, ctx?.senderId)
  });
}
// src/deep-to-raw.ts
function deepToRaw(input, seen = new WeakMap) {
  if (input === null || typeof input !== "object") {
    return input;
  }
  if (isRef(input)) {
    return deepToRaw(input.value, seen);
  }
  if (seen.has(input)) {
    return seen.get(input);
  }
  if (Array.isArray(input)) {
    const result = [];
    seen.set(input, result);
    for (const item of input) {
      result.push(deepToRaw(item, seen));
    }
    return result;
  }
  if (input instanceof Date) {
    return new Date(input.getTime());
  }
  if (input instanceof Map) {
    const result = new Map;
    seen.set(input, result);
    for (const [key, value] of input) {
      result.set(deepToRaw(key, seen), deepToRaw(value, seen));
    }
    return result;
  }
  if (input instanceof Set) {
    const result = new Set;
    seen.set(input, result);
    for (const value of input) {
      result.add(deepToRaw(value, seen));
    }
    return result;
  }
  const source = isReactive(input) ? toRaw(input) : input;
  if (seen.has(source)) {
    return seen.get(source);
  }
  if (source && typeof source === "object" && (source.constructor === Object || source.constructor === null)) {
    const result = Object.create(Object.getPrototypeOf(source));
    seen.set(input, result);
    seen.set(source, result);
    for (const key of Reflect.ownKeys(source)) {
      result[key] = deepToRaw(source[key], seen);
    }
    return result;
  }
  return source;
}
