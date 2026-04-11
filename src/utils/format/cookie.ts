function formatCookie(arr: Array<string | number | undefined>, urlBase: string): string {
  return `${arr[0]}=${arr[1]}; Path=${arr[3]}; Domain=${urlBase}.com`;
}

export = {
  formatCookie
};
