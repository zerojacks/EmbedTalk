import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizePath(path: string): string {
  // 统一路径分隔符为正斜杠
  return path.replace(/\\/g, '/');
}

export {};
