import axios, { type AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

const jar = new CookieJar();
const client = wrapper(
  axios.create({
    jar,
    withCredentials: true,
    timeout: 60000,
    validateStatus: (s) => s >= 200 && s < 600,
    maxRedirects: 5,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  })
) as AxiosInstance;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export { jar, client, delay };
