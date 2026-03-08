var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/@vue/shared/dist/shared.cjs.js
var require_shared_cjs = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
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
  var hasOwn = (val, key) => hasOwnProperty.call(val, key);
  var isArray = Array.isArray;
  var isMap = (val) => toTypeString(val) === "[object Map]";
  var isSet = (val) => toTypeString(val) === "[object Set]";
  var isDate = (val) => toTypeString(val) === "[object Date]";
  var isRegExp = (val) => toTypeString(val) === "[object RegExp]";
  var isFunction = (val) => typeof val === "function";
  var isString = (val) => typeof val === "string";
  var isSymbol = (val) => typeof val === "symbol";
  var isObject4 = (val) => val !== null && typeof val === "object";
  var isPromise = (val) => {
    return (isObject4(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
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
    } else if (isString(value) || isObject4(value)) {
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
    } else if (isObject4(value)) {
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
    aValidType = isObject4(a);
    bValidType = isObject4(b);
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
    return isString(val) ? val : val == null ? "" : isArray(val) || isObject4(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef3(val) ? toDisplayString(val.value) : JSON.stringify(val, replacer, 2) : String(val);
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
    } else if (isObject4(val) && !isArray(val) && !isPlainObject(val)) {
      return String(val);
    }
    return val;
  };
  var stringifySymbol = (v, i = "") => {
    var _a;
    return isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v;
  };
  exports.EMPTY_ARR = EMPTY_ARR;
  exports.EMPTY_OBJ = EMPTY_OBJ;
  exports.NO = NO;
  exports.NOOP = NOOP;
  exports.PatchFlagNames = PatchFlagNames;
  exports.PatchFlags = PatchFlags;
  exports.ShapeFlags = ShapeFlags;
  exports.SlotFlags = SlotFlags;
  exports.camelize = camelize;
  exports.capitalize = capitalize;
  exports.cssVarNameEscapeSymbolsRE = cssVarNameEscapeSymbolsRE;
  exports.def = def;
  exports.escapeHtml = escapeHtml;
  exports.escapeHtmlComment = escapeHtmlComment;
  exports.extend = extend;
  exports.genCacheKey = genCacheKey;
  exports.genPropsAccessExp = genPropsAccessExp;
  exports.generateCodeFrame = generateCodeFrame;
  exports.getEscapedCssVarName = getEscapedCssVarName;
  exports.getGlobalThis = getGlobalThis;
  exports.hasChanged = hasChanged;
  exports.hasOwn = hasOwn;
  exports.hyphenate = hyphenate;
  exports.includeBooleanAttr = includeBooleanAttr;
  exports.invokeArrayFns = invokeArrayFns;
  exports.isArray = isArray;
  exports.isBooleanAttr = isBooleanAttr;
  exports.isBuiltInDirective = isBuiltInDirective;
  exports.isDate = isDate;
  exports.isFunction = isFunction;
  exports.isGloballyAllowed = isGloballyAllowed;
  exports.isGloballyWhitelisted = isGloballyWhitelisted;
  exports.isHTMLTag = isHTMLTag;
  exports.isIntegerKey = isIntegerKey;
  exports.isKnownHtmlAttr = isKnownHtmlAttr;
  exports.isKnownMathMLAttr = isKnownMathMLAttr;
  exports.isKnownSvgAttr = isKnownSvgAttr;
  exports.isMap = isMap;
  exports.isMathMLTag = isMathMLTag;
  exports.isModelListener = isModelListener;
  exports.isObject = isObject4;
  exports.isOn = isOn;
  exports.isPlainObject = isPlainObject;
  exports.isPromise = isPromise;
  exports.isRegExp = isRegExp;
  exports.isRenderableAttrValue = isRenderableAttrValue;
  exports.isReservedProp = isReservedProp;
  exports.isSSRSafeAttrName = isSSRSafeAttrName;
  exports.isSVGTag = isSVGTag;
  exports.isSet = isSet;
  exports.isSpecialBooleanAttr = isSpecialBooleanAttr;
  exports.isString = isString;
  exports.isSymbol = isSymbol;
  exports.isVoidTag = isVoidTag;
  exports.looseEqual = looseEqual;
  exports.looseIndexOf = looseIndexOf;
  exports.looseToNumber = looseToNumber;
  exports.makeMap = makeMap;
  exports.normalizeClass = normalizeClass;
  exports.normalizeProps = normalizeProps;
  exports.normalizeStyle = normalizeStyle;
  exports.objectToString = objectToString;
  exports.parseStringStyle = parseStringStyle;
  exports.propsToAttrMap = propsToAttrMap;
  exports.remove = remove;
  exports.slotFlagsText = slotFlagsText;
  exports.stringifyStyle = stringifyStyle;
  exports.toDisplayString = toDisplayString;
  exports.toHandlerKey = toHandlerKey;
  exports.toNumber = toNumber;
  exports.toRawType = toRawType;
  exports.toTypeString = toTypeString;
});

// node_modules/@vue/reactivity/dist/reactivity.cjs.js
var require_reactivity_cjs = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
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
  exports.ARRAY_ITERATE_KEY = ARRAY_ITERATE_KEY;
  exports.EffectFlags = EffectFlags;
  exports.EffectScope = EffectScope;
  exports.ITERATE_KEY = ITERATE_KEY;
  exports.MAP_KEY_ITERATE_KEY = MAP_KEY_ITERATE_KEY;
  exports.ReactiveEffect = ReactiveEffect;
  exports.ReactiveFlags = ReactiveFlags2;
  exports.TrackOpTypes = TrackOpTypes;
  exports.TriggerOpTypes = TriggerOpTypes;
  exports.WatchErrorCodes = WatchErrorCodes;
  exports.computed = computed2;
  exports.customRef = customRef;
  exports.effect = effect;
  exports.effectScope = effectScope;
  exports.enableTracking = enableTracking;
  exports.getCurrentScope = getCurrentScope;
  exports.getCurrentWatcher = getCurrentWatcher;
  exports.isProxy = isProxy;
  exports.isReactive = isReactive2;
  exports.isReadonly = isReadonly;
  exports.isRef = isRef3;
  exports.isShallow = isShallow;
  exports.markRaw = markRaw2;
  exports.onEffectCleanup = onEffectCleanup;
  exports.onScopeDispose = onScopeDispose;
  exports.onWatcherCleanup = onWatcherCleanup;
  exports.pauseTracking = pauseTracking;
  exports.proxyRefs = proxyRefs;
  exports.reactive = reactive2;
  exports.reactiveReadArray = reactiveReadArray;
  exports.readonly = readonly;
  exports.ref = ref2;
  exports.resetTracking = resetTracking;
  exports.shallowReactive = shallowReactive;
  exports.shallowReadArray = shallowReadArray;
  exports.shallowReadonly = shallowReadonly;
  exports.shallowRef = shallowRef;
  exports.stop = stop;
  exports.toRaw = toRaw2;
  exports.toReactive = toReactive;
  exports.toReadonly = toReadonly;
  exports.toRef = toRef2;
  exports.toRefs = toRefs2;
  exports.toValue = toValue;
  exports.track = track2;
  exports.traverse = traverse2;
  exports.trigger = trigger2;
  exports.triggerRef = triggerRef2;
  exports.unref = unref3;
  exports.watch = watch2;
});
// src/utils.ts
var deepEqualCache = new WeakMap;
var MAX_CACHE_SIZE = 1000;
var pathCache = new WeakMap;
var pathCacheSize = new WeakMap;
var pathConcatCache = new Map;
var MAX_PATH_CACHE_SIZE = 1000;
var globalSeen = new WeakMap;
var wrapperCache = new WeakMap;
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
function cleanupPathConcatCache() {
  if (pathConcatCache.size > MAX_PATH_CACHE_SIZE) {
    const entriesToRemove = Math.floor(MAX_PATH_CACHE_SIZE * 0.2);
    let count = 0;
    for (const key of pathConcatCache.keys()) {
      if (count >= entriesToRemove)
        break;
      pathConcatCache.delete(key);
      count++;
    }
  }
}
function deepEqual(a, b, seen = globalSeen) {
  if (a === b)
    return true;
  if (a == null || b == null)
    return a === b;
  if (typeof a !== typeof b)
    return false;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (typeof a !== "object")
    return false;
  if (Array.isArray(a) !== Array.isArray(b))
    return false;
  if (seen.has(a))
    return seen.get(a) === b;
  seen.set(a, b);
  if (deepEqualCache.has(a) && deepEqualCache.get(a)?.has(b)) {
    return deepEqualCache.get(a).get(b);
  }
  if (!deepEqualCache.has(a)) {
    deepEqualCache.set(a, new WeakMap);
  }
  let result;
  if (Array.isArray(a)) {
    result = a.length === b.length && a.every((val, idx) => deepEqual(val, b[idx], seen));
  } else if (a instanceof Map && b instanceof Map) {
    result = a.size === b.size;
    if (result) {
      for (const [key, value] of a) {
        if (!b.has(key) || !deepEqual(value, b.get(key), seen)) {
          result = false;
          break;
        }
      }
    }
  } else if (a instanceof Set && b instanceof Set) {
    result = a.size === b.size;
    if (result) {
      for (const value of a) {
        if (!b.has(value)) {
          result = false;
          break;
        }
      }
    }
  } else {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    result = keysA.length === keysB.length && keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key], seen));
  }
  deepEqualCache.get(a).set(b, result);
  return result;
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
function getPathConcat(path) {
  const result = pathConcatCache.get(path);
  if (result !== undefined) {
    pathConcatCache.delete(path);
    pathConcatCache.set(path, result);
  }
  return result;
}
function setPathConcat(path, value) {
  if (pathConcatCache.has(path)) {
    pathConcatCache.delete(path);
  }
  pathConcatCache.set(path, value);
  cleanupPathConcatCache();
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
function deepClone(value, seen = new WeakMap) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  if (Array.isArray(value)) {
    const newArray = [];
    seen.set(value, newArray);
    for (let i = 0;i < value.length; i++) {
      newArray[i] = deepClone(value[i], seen);
    }
    return newArray;
  }
  if (value instanceof Map) {
    const newMap = new Map;
    seen.set(value, newMap);
    value.forEach((val, key) => {
      newMap.set(deepClone(key, seen), deepClone(val, seen));
    });
    return newMap;
  }
  if (value instanceof Set) {
    const newSet = new Set;
    seen.set(value, newSet);
    value.forEach((val) => {
      newSet.add(deepClone(val, seen));
    });
    return newSet;
  }
  const newObject = Object.create(Object.getPrototypeOf(value));
  seen.set(value, newObject);
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
  "map-set": function(targetMap, _parentKeyIgnored, event) {
    if (!(targetMap instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    targetMap.set(event.key, event.newValue);
  },
  "map-delete": function(targetMap, _parentKeyIgnored, event) {
    if (!(targetMap instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    targetMap.delete(event.key);
  },
  "map-clear": function(targetMap, _parentKeyIgnored, event) {
    if (!(targetMap instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    targetMap.clear();
  },
  "set-add": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    targetSet.add(event.value);
  },
  "set-delete": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    targetSet.delete(event.value);
  },
  "set-clear": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    targetSet.clear();
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
      for (const [key, value] of newValueEntries) {
        target.set(key, value);
      }
    } else if (target instanceof Set && newValue instanceof Set) {
      const newValueEntries = [...newValue.values()];
      target.clear();
      for (const value of newValueEntries) {
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

// src/wrap-set.ts
function wrapSet(set, emit, path = []) {
  const cachedProxy = wrapperCache.get(set);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(set))
    return globalSeen.get(set);
  const methodCache = {};
  const proxy = new Proxy(set, {
    get(target, prop, receiver) {
      track(target, prop);
      if (prop === Symbol.iterator || prop === "entries" || prop === "values" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
      }
      if (methodCache[prop]) {
        return methodCache[prop];
      }
      if (prop === "add") {
        methodCache[prop] = function(value2) {
          const existed = target.has(value2);
          const oldSize = target.size;
          if (!existed) {
            target.add(value2);
            const newSize = target.size;
            const event = {
              action: "set-add",
              path,
              value: value2
            };
            emit?.(event);
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
            const result = target.delete(value2);
            const newSize = target.size;
            if (result) {
              const event = {
                action: "set-delete",
                path,
                value: value2,
                oldValue
              };
              emit?.(event);
              trigger(target, Symbol.iterator);
              if (oldSize !== newSize) {
                trigger(target, "size");
              }
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
          target.clear();
          const newSize = target.size;
          const event = {
            action: "set-clear",
            path,
            value: null
          };
          emit?.(event);
          trigger(target, Symbol.iterator);
          if (oldSize !== newSize) {
            trigger(target, "size");
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
            let wrappedValue = valueToWrap;
            if (valueToWrap && typeof valueToWrap === "object") {
              if (globalSeen.has(valueToWrap)) {
                wrappedValue = globalSeen.get(valueToWrap);
              } else {
                const cachedValueProxy = wrapperCache.get(valueToWrap);
                if (cachedValueProxy) {
                  wrappedValue = cachedValueProxy;
                } else {
                  const keyForPath = String(index);
                  const pathKey = path.length > 0 ? `${path.join(".")}.${keyForPath}` : keyForPath;
                  let newPath = getPathConcat(pathKey);
                  if (newPath === undefined) {
                    newPath = path.concat(keyForPath);
                    setPathConcat(pathKey, newPath);
                  }
                  if (valueToWrap instanceof Map)
                    wrappedValue = wrapMap(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Set)
                    wrappedValue = wrapSet(valueToWrap, emit, newPath);
                  else if (Array.isArray(valueToWrap))
                    wrappedValue = wrapArray(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Date)
                    wrappedValue = new Date(valueToWrap.getTime());
                  else
                    wrappedValue = reactive(valueToWrap, emit, newPath);
                }
              }
            }
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
  return proxy;
}

// src/wrap-map.ts
function wrapMap(map, emit, path = []) {
  const cachedProxy = wrapperCache.get(map);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(map))
    return globalSeen.get(map);
  const methodCache = {};
  const proxy = new Proxy(map, {
    get(target, prop, receiver) {
      track(target, prop);
      if (prop === Symbol.iterator || prop === "entries" || prop === "values" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
      }
      if (methodCache[prop]) {
        return methodCache[prop];
      }
      if (prop === "set") {
        methodCache[prop] = function(key, value2) {
          const existed = target.has(key);
          const oldValue = target.get(key);
          const oldSize = target.size;
          if (oldValue === value2)
            return receiver;
          if (oldValue && typeof oldValue === "object" && value2 && typeof value2 === "object" && deepEqual(oldValue, value2, new WeakMap))
            return receiver;
          target.set(key, value2);
          const newSize = target.size;
          const pathKey = path.join(".");
          let cachedPath = getPathConcat(pathKey);
          if (cachedPath === undefined) {
            cachedPath = path;
            setPathConcat(pathKey, cachedPath);
          }
          const event = {
            action: "map-set",
            path: cachedPath,
            key,
            oldValue,
            newValue: value2
          };
          emit?.(event);
          if (!existed) {
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
          } else {
            trigger(target, String(key));
          }
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
          const result = target.delete(key);
          const newSize = target.size;
          if (result) {
            const pathKey = path.join(".");
            let cachedPath = getPathConcat(pathKey);
            if (cachedPath === undefined) {
              cachedPath = path;
              setPathConcat(pathKey, cachedPath);
            }
            const event = {
              action: "map-delete",
              path: cachedPath,
              key,
              oldValue
            };
            emit?.(event);
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
            trigger(target, String(key));
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
          target.clear();
          const newSize = target.size;
          const event = {
            action: "map-clear",
            path,
            key: null
          };
          emit?.(event);
          trigger(target, Symbol.iterator);
          if (oldSize !== newSize) {
            trigger(target, "size");
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
          if (globalSeen.has(value2))
            return globalSeen.get(value2);
          const cachedValueProxy = wrapperCache.get(value2);
          if (cachedValueProxy)
            return cachedValueProxy;
          const keyString = String(key);
          const pathKey = path.length > 0 ? `${path.join(".")}.${keyString}` : keyString;
          let newPath = getPathConcat(pathKey);
          if (newPath === undefined) {
            newPath = path.concat(keyString);
            setPathConcat(pathKey, newPath);
          }
          if (value2 instanceof Map)
            return wrapMap(value2, emit, newPath);
          if (value2 instanceof Set)
            return wrapSet(value2, emit, newPath);
          if (Array.isArray(value2))
            return wrapArray(value2, emit, newPath);
          if (value2 instanceof Date)
            return new Date(value2.getTime());
          return reactive(value2, emit, newPath);
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
        const originalMethod = Reflect.get(target, prop, receiver);
        if (prop === "forEach") {
          methodCache[prop] = (callbackfn, thisArg) => {
            const entriesIterator = proxy.entries();
            for (const [key, value2] of entriesIterator) {
              callbackfn.call(thisArg, value2, key, proxy);
            }
          };
          return methodCache[prop];
        }
        methodCache[prop] = function* (...args) {
          const iterator = originalMethod.apply(target, args);
          for (const entry of iterator) {
            let keyToWrap = entry;
            let valueToWrap = entry;
            let isEntry = false;
            if (prop === "entries" || prop === Symbol.iterator) {
              keyToWrap = entry[0];
              valueToWrap = entry[1];
              isEntry = true;
            }
            let wrappedKey = keyToWrap;
            if (isEntry && keyToWrap && typeof keyToWrap === "object") {
              if (globalSeen.has(keyToWrap)) {
                wrappedKey = globalSeen.get(keyToWrap);
              } else {
                const pathKey = path.length > 0 ? `${path.join(".")}.${String(keyToWrap)}` : String(keyToWrap);
                let keyPath = getPathConcat(pathKey);
                if (keyPath === undefined) {
                  keyPath = path.concat(String(keyToWrap));
                  setPathConcat(pathKey, keyPath);
                }
                wrappedKey = reactive(keyToWrap, emit, keyPath);
              }
            }
            let wrappedValue = valueToWrap;
            if (valueToWrap && typeof valueToWrap === "object") {
              if (globalSeen.has(valueToWrap)) {
                wrappedValue = globalSeen.get(valueToWrap);
              } else {
                const cachedValueProxy = wrapperCache.get(valueToWrap);
                if (cachedValueProxy) {
                  wrappedValue = cachedValueProxy;
                } else {
                  const keyString = String(keyToWrap);
                  const pathKey = path.length > 0 ? `${path.join(".")}.${keyString}` : keyString;
                  let newPath = getPathConcat(pathKey);
                  if (newPath === undefined) {
                    newPath = path.concat(keyString);
                    setPathConcat(pathKey, newPath);
                  }
                  if (valueToWrap instanceof Map)
                    wrappedValue = wrapMap(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Set)
                    wrappedValue = wrapSet(valueToWrap, emit, newPath);
                  else if (Array.isArray(valueToWrap))
                    wrappedValue = wrapArray(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Date)
                    wrappedValue = new Date(valueToWrap.getTime());
                  else
                    wrappedValue = reactive(valueToWrap, emit, newPath);
                }
              }
            }
            if (prop === "entries" || prop === Symbol.iterator) {
              yield [wrappedKey, wrappedValue];
            } else if (prop === "values") {
              yield wrappedValue;
            } else {
              yield wrappedKey;
            }
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
  return proxy;
}

// src/wrap-array.ts
function isObject2(v) {
  return v && typeof v === "object";
}
function wrapArray(arr, emit, path = []) {
  const cachedProxy = wrapperCache.get(arr);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(arr))
    return globalSeen.get(arr);
  const methodCache = {};
  const proxy = new Proxy(arr, {
    get(target, prop, receiver) {
      track(target, prop);
      if (methodCache[prop]) {
        return methodCache[prop];
      }
      switch (prop) {
        case "push":
          track(target, "length");
          methodCache[prop] = function(...items) {
            const oldLength = target.length;
            const result = target.push(...items);
            const newLength = target.length;
            if (items.length > 0) {
              const event = {
                action: "array-push",
                path,
                key: oldLength,
                items
              };
              emit?.(event);
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
            const result = target.pop();
            const newLength = target.length;
            const event = {
              action: "array-pop",
              path,
              key: poppedIndex,
              oldValue
            };
            emit?.(event);
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
            const result = target.shift();
            const newLength = target.length;
            const event = {
              action: "array-shift",
              path,
              key: 0,
              oldValue
            };
            emit?.(event);
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
            const oldLength = target.length;
            const result = target.unshift(...items);
            const newLength = target.length;
            if (items.length > 0) {
              const event = {
                action: "array-unshift",
                path,
                key: 0,
                items
              };
              emit?.(event);
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
          methodCache[prop] = function(start, deleteCount, ...items) {
            const oldLength = target.length;
            const actualStart = start < 0 ? Math.max(target.length + start, 0) : Math.min(start, target.length);
            const deleteCountNum = deleteCount === undefined ? target.length - actualStart : Number(deleteCount);
            const actualDeleteCount = Math.min(deleteCountNum, target.length - actualStart);
            const deletedItems = target.slice(actualStart, actualStart + actualDeleteCount);
            const result = target.splice(start, deleteCountNum, ...items);
            const newLength = target.length;
            if (actualDeleteCount > 0 || items.length > 0) {
              const event = {
                action: "array-splice",
                path,
                key: actualStart,
                deleteCount: actualDeleteCount,
                items: items.length > 0 ? items : undefined,
                oldValues: deletedItems.length > 0 ? deletedItems : undefined
              };
              emit?.(event);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return result;
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
              if (!isObject2(value2))
                return value2;
              const propKey = String(idx);
              const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
              let newPath = getPathConcat(pathKey);
              if (newPath === undefined) {
                newPath = path.concat(propKey);
                setPathConcat(pathKey, newPath);
              }
              if (globalSeen.has(value2))
                return globalSeen.get(value2);
              const cachedValueProxy = wrapperCache.get(value2);
              if (cachedValueProxy)
                return cachedValueProxy;
              if (Array.isArray(value2))
                return wrapArray(value2, emit, newPath);
              if (value2 instanceof Map)
                return wrapMap(value2, emit, newPath);
              if (value2 instanceof Set)
                return wrapSet(value2, emit, newPath);
              if (value2 instanceof Date)
                return new Date(value2.getTime());
              return reactive(value2, emit, newPath);
            };
          }
          return methodCache[prop];
        }
        case "at": {
          track(target, Symbol.iterator);
          if (!methodCache[prop]) {
            methodCache[prop] = function(index) {
              let idx = Number(index);
              if (!Number.isInteger(idx))
                idx = Math.trunc(idx);
              if (idx < 0)
                idx = target.length + idx;
              if (idx < 0 || idx >= target.length)
                return;
              const value2 = target[idx];
              if (!isObject2(value2))
                return value2;
              const propKey = String(idx);
              const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
              let newPath = getPathConcat(pathKey);
              if (newPath === undefined) {
                newPath = path.concat(propKey);
                setPathConcat(pathKey, newPath);
              }
              if (globalSeen.has(value2))
                return globalSeen.get(value2);
              const cachedValueProxy = wrapperCache.get(value2);
              if (cachedValueProxy)
                return cachedValueProxy;
              if (Array.isArray(value2))
                return wrapArray(value2, emit, newPath);
              if (value2 instanceof Map)
                return wrapMap(value2, emit, newPath);
              if (value2 instanceof Set)
                return wrapSet(value2, emit, newPath);
              if (value2 instanceof Date)
                return new Date(value2.getTime());
              return reactive(value2, emit, newPath);
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
      const isNumericIndex = typeof prop === "number" || typeof prop === "string" && !isNaN(parseInt(prop, 10));
      if (isNumericIndex) {
        track(target, String(prop));
        if (!isObject2(value))
          return value;
        if (globalSeen.has(value))
          return globalSeen.get(value);
        const cachedValueProxy = wrapperCache.get(value);
        if (cachedValueProxy)
          return cachedValueProxy;
        const propKey = String(prop);
        const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);
        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }
        if (Array.isArray(value))
          return wrapArray(value, emit, newPath);
        if (value instanceof Map)
          return wrapMap(value, emit, newPath);
        if (value instanceof Set)
          return wrapSet(value, emit, newPath);
        if (value instanceof Date)
          return new Date(value.getTime());
        return reactive(value, emit, newPath);
      }
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
    set(target, prop, value, receiver) {
      const oldValue = target[prop];
      if (oldValue === value)
        return true;
      if (isObject2(oldValue) && isObject2(value) && deepEqual(oldValue, value, new WeakMap))
        return true;
      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      const result = Reflect.set(target, prop, value, receiver);
      const isNumericIndex = typeof prop === "number" || typeof prop === "string" && !isNaN(parseInt(String(prop)));
      if (result && (!descriptor || !descriptor.set || isNumericIndex)) {
        const propKey = String(prop);
        const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);
        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }
        const event = {
          action: "set",
          path: newPath,
          oldValue,
          newValue: value
        };
        emit?.(event);
        trigger(target, prop);
      }
      return result;
    }
  });
  globalSeen.set(arr, proxy);
  wrapperCache.set(arr, proxy);
  return proxy;
}

// src/reactive.ts
function isObject3(v) {
  return v && typeof v === "object";
}
function isReactive(value) {
  return !!(value && value["__v_isReactive" /* IS_REACTIVE */]);
}
function toRaw(observed) {
  const raw = observed && observed["__v_raw" /* RAW */];
  return raw ? toRaw(raw) : observed;
}
function reactive(obj, emit, path = []) {
  if (obj["__v_skip" /* SKIP */]) {
    return obj;
  }
  if (globalSeen.has(obj))
    return globalSeen.get(obj);
  if (emit && path.length === 0) {
    try {
      const initialEvent = {
        action: "replace",
        path: [],
        newValue: obj
      };
      emit(initialEvent);
    } catch (error) {
      console.error("Failed to emit initial reactive state:", error);
    }
  }
  if (Array.isArray(obj)) {
    return wrapArray(obj, emit, path);
  }
  if (obj instanceof Map) {
    return wrapMap(obj, emit, path);
  }
  if (obj instanceof Set) {
    return wrapSet(obj, emit, path);
  }
  function wrapValue(val, subPath) {
    if (!isObject3(val))
      return val;
    if (globalSeen.has(val))
      return globalSeen.get(val);
    if (Array.isArray(val))
      return wrapArray(val, emit, subPath);
    if (val instanceof Map)
      return wrapMap(val, emit, subPath);
    if (val instanceof Set)
      return wrapSet(val, emit, subPath);
    if (val instanceof Date)
      return new Date(val.getTime());
    return reactive(val, emit, subPath);
  }
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
      if (!isObject3(value))
        return value;
      const propKey = String(prop);
      const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
      let newPath = getPathConcat(pathKey);
      if (newPath === undefined) {
        newPath = path.concat(propKey);
        setPathConcat(pathKey, newPath);
      }
      return wrapValue(value, newPath);
    },
    set(target, prop, value, receiver) {
      const oldValue = target[prop];
      if (oldValue === value)
        return true;
      if (isObject3(oldValue) && isObject3(value) && deepEqual(oldValue, value, new WeakMap))
        return true;
      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      const result = Reflect.set(target, prop, value, receiver);
      if (result && (!descriptor || !descriptor.set)) {
        const propKey = String(prop);
        const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);
        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }
        const event = {
          action: "set",
          path: newPath,
          oldValue,
          newValue: value
        };
        emit?.(event);
        trigger(target, prop);
      }
      return result;
    },
    deleteProperty(target, prop) {
      const oldValue = target[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const result = Reflect.deleteProperty(target, prop);
      if (hadProperty && result) {
        const propKey = String(prop);
        const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);
        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }
        const event = {
          action: "delete",
          path: newPath,
          oldValue
        };
        emit?.(event);
        trigger(target, prop);
      }
      return result;
    }
  });
  globalSeen.set(obj, proxy);
  return proxy;
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
var import_reactivity = __toESM(require_reactivity_cjs(), 1);
import { watchEffect as watchEffect2 } from "vue";
function trackVueReactiveEvents(vueState, emit, options = {}) {
  const { emitInitialReplace = true } = options;
  if (emitInitialReplace) {
    try {
      emit({ action: "replace", path: [], newValue: deepClone(vueState) });
    } catch (e) {}
  }
  const prev = {};
  const pathStack = [];
  const keyStops = new Map;
  for (const k of Object.keys(vueState)) {
    prev[k] = deepClone(vueState[k]);
  }
  function createKeyEffect(k) {
    const stop = watchEffect2(() => {
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
        pathStack.length = 0;
        prev[k] = deepClone(vueState[k]);
        return;
      }
      pathStack.pop();
    }, { flush: "sync" });
    keyStops.set(k, stop);
  }
  for (const k of Object.keys(prev)) {
    createKeyEffect(k);
  }
  const stopRoot = watchEffect2(() => {
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
  return () => {
    stopRoot();
    for (const stop of keyStops.values())
      stop();
    keyStops.clear();
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
    pathStack.push("length");
    emit({ action: "set", path: pathStack.slice(), newValue: curr.length, oldValue: old.length });
    pathStack.pop();
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
export {
  watchEffect,
  watch,
  updateState,
  unref,
  triggerRef,
  trigger,
  trackVueReactiveEvents,
  track,
  toRefs,
  toRef,
  toRaw,
  setActiveEffect,
  runCleanupFunctions,
  ref,
  reactive,
  markRaw,
  isRefSymbol,
  isRef,
  isReactive,
  isComputed,
  deepToRaw,
  deepEqual,
  deepClone,
  createRendererBridgeEmitter,
  createMainBridgeEmitter,
  createBridgeEmitter,
  computed,
  cleanupEffect,
  activeEffect
};
