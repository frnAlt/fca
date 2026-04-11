function getType(obj: Loose): string {
  return Object.prototype.toString.call(obj).slice(8, -1);
}

function formatID(id: string | undefined | null): string | undefined | null {
  if (id !== undefined && id !== null) return id.replace(/(fb)?id[:.]/, "");
  return id;
}

function padZeros(val: string | number, len = 2): string {
  let out = String(val);
  while (out.length < len) out = "0" + out;
  return out;
}

function arrayToObject<T, K extends string | number | symbol, V>(
  arr: T[],
  getKey: (value: T) => K,
  getValue: (value: T) => V
): Record<K, V> {
  return arr.reduce((acc, val) => {
    acc[getKey(val)] = getValue(val);
    return acc;
  }, {} as Record<K, V>);
}

function arrToForm<T extends { name: string; val: Loose }>(form: T[]): Record<string, Loose> {
  return arrayToObject(
    form,
    (v) => v.name,
    (v) => v.val
  );
}

function getData_Path(Obj: Loose, Arr: string[], Stt: number): Loose {
  if (Arr.length === 0 && Obj !== undefined) {
    return Obj;
  }
  if (Obj === undefined) {
    return Stt;
  }
  const head = Arr[0];
  if (head === undefined) {
    return Stt;
  }
  const tail = Arr.slice(1);
  return getData_Path(Obj[head], tail, Stt++);
}

function setData_Path(obj: Loose, path: string[], value: Loose): Loose {
  if (!path.length) {
    return obj;
  }
  const currentKey = path[0];
  let currentObj = obj[currentKey];

  if (!currentObj) {
    obj[currentKey] = value;
    currentObj = obj[currentKey];
  }
  path.shift();
  if (!path.length) {
    currentObj = value;
  } else {
    currentObj = setData_Path(currentObj, path, value);
  }

  return obj;
}

function getPaths(obj: Record<string, Loose>, parentPath: string[] = []): string[][] {
  let paths: string[][] = [];
  for (const prop in obj) {
    if (typeof obj[prop] === "object" && obj[prop] !== null) {
      paths = paths.concat(getPaths(obj[prop] as Record<string, Loose>, [...parentPath, prop]));
    } else {
      paths.push([...parentPath, prop]);
    }
  }
  return paths;
}

function cleanHTML(text: string): string {
  let out = text;
  out = out.replace(
    /(<br>)|(<\/?i>)|(<\/?em>)|(<\/?b>)|(!?~)|(&amp;)|(&#039;)|(&lt;)|(&gt;)|(&quot;)/g,
    (match) => {
      switch (match) {
        case "<br>":
          return "\n";
        case "<i>":
        case "<em>":
        case "</i>":
        case "</em>":
          return "*";
        case "<b>":
        case "</b>":
          return "**";
        case "~!":
        case "!~":
          return "||";
        case "&amp;":
          return "&";
        case "&#039;":
          return "'";
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        case "&quot;":
          return '"';
        default:
          return match;
      }
    }
  );
  return out;
}

function getCurrentTimestamp(): number {
  return Date.now();
}

function getSignatureID(): string {
  return Math.floor(Math.random() * 2147483648).toString(16);
}

export {
  getType,
  formatID,
  padZeros,
  arrayToObject,
  arrToForm,
  getData_Path,
  setData_Path,
  getPaths,
  cleanHTML,
  getCurrentTimestamp,
  getSignatureID
};


