declare module NodeJS {
  interface Global {
    DEBUG: boolean;
    DEV: boolean;
    VERBOSE: boolean;
    isWebpackBuild?: boolean;
  }
}

// global fix for object keys

type ObjectKeys<T> =
  // prettier-ignore
  T extends object ? (keyof T)[] :
  T extends number ? [] :
  T extends Array<any> | string ? string[] :
  never;

interface ObjectConstructor {
  keys<T>(o: T): ObjectKeys<T>;
}

interface Set<T> {
  toJSON(): Array<T>;
}
