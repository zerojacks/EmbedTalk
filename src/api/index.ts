import { initPlatform, isPlatform } from "../utils/platform";
import { desktopApi } from "./desktop";
import { ApiInterface } from "./types";
import { webApi } from "./web";

export * from "./types";

// A singleton instance of the API.
let apiInstance: ApiInterface | null = null;

/**
 * Asynchronously gets the API instance.
 * It initializes the platform on the first call and then
 * returns the appropriate API implementation (desktop or web).
 */
export const getApi = async (): Promise<ApiInterface> => {
  // If the instance already exists, return it.
  if (apiInstance) {
    return apiInstance;
  }

  // Wait for platform detection to complete.
  await initPlatform();

  // Create the instance based on the detected platform.
  apiInstance = isPlatform.isDesktop ? desktopApi : webApi;
  console.log("API instance created for:", isPlatform.isDesktop ? "Desktop" : "Web");

  // Return the created instance.
  return apiInstance;
};