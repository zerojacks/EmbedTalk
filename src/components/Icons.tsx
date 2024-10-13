import React from 'react';

interface IconProps {
  className?: string;
}

export const ChevronRight: React.FC<IconProps> = ({ className }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.5 15L12.5 10L7.5 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronDown: React.FC<IconProps> = ({ className }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 7.5L10 12.5L15 7.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MapIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
)

export const CopyImage: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path d="M773.689 277.333c28.277 0 51.2 22.923 51.2 51.2v497.304c0 28.277-22.923 51.2-51.2 51.2H93.867c-28.277 0-51.2-22.923-51.2-51.2V328.533c0-28.277 22.923-51.2 51.2-51.2h679.822z m-25.6 76.8H119.467l-0.001 389.352 254.452-218.101c35.145-30.125 87.277-29.165 121.29 2.231l252.88 233.428v-406.91z m206.45-207.17a0.72 0.72 0 0 1 0.72 0.72v572.91c0 14.4-11.674 26.074-26.074 26.074-14.4 0-26.074-11.674-26.074-26.074V199.11H251.258c-14.4 0-26.074-11.674-26.074-26.074 0-14.4 11.674-26.074 26.074-26.074h703.28zM251.26 433.778c28.8 0 52.148 23.347 52.148 52.148 0 28.8-23.347 52.148-52.148 52.148-28.8 0-52.148-23.347-52.148-52.148 0-28.8 23.348-52.148 52.148-52.148z" fill="currentColor" p-id="4454"></path>
  </svg>
)
export const ExportImage: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path d="M160 652.224l238.336-119.168 135.04 330.944H576v64H192A96 96 0 0 1 96 832V192A96 96 0 0 1 192 96h640A96 96 0 0 1 928 192v384h-64V192a32 32 0 0 0-32-32H192a32 32 0 0 0-32 32v460.224z m0 71.552V832a32 32 0 0 0 32 32h273.28L369.664 618.88 160 723.84z m640 94.976l73.344-73.408 45.312 45.312L768 941.248l-150.656-150.592 45.312-45.312 73.344 73.408V576h64v242.752zM640 416a96 96 0 1 1 0-192 96 96 0 0 1 0 192z m0-64a32 32 0 1 0 0-64 32 32 0 0 0 0 64z" fill="currentColor" p-id="3110"></path>
  </svg>
)

export const CancelIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10s10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8zm3.59-13L12 10.59L8.41 7L7 8.41L10.59 12L7 15.59L8.41 17L12 13.41L15.59 17L17 15.59L13.41 12L17 8.41z" fill="currentColor"></path>
  </svg>
)

export const ExpandAll: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path d="M12 10h14a2.002 2.002 0 0 0 2-2V4a2.002 2.002 0 0 0-2-2H12a2.002 2.002 0 0 0-2 2v1H6V2H4v23a2.002 2.002 0 0 0 2 2h4v1a2.002 2.002 0 0 0 2 2h14a2.002 2.002 0 0 0 2-2v-4a2.002 2.002 0 0 0-2-2H12a2.002 2.002 0 0 0-2 2v1H6v-8h4v1a2.002 2.002 0 0 0 2 2h14a2.002 2.002 0 0 0 2-2v-4a2.002 2.002 0 0 0-2-2H12a2.002 2.002 0 0 0-2 2v1H6V7h4v1a2.002 2.002 0 0 0 2 2zm0-6h14l.001 4H12zm0 20h14l.001 4H12zm0-10h14l.001 4H12z" fill="currentColor"></path>
  </svg>
)
export const ThemeIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path d="M512 42.666667C252.8 42.666667 29.12 253.173333 42.666667 512c18.453333 353.013333 429.546667 149.333333 466.666666 426.666667a47.04 47.04 0 0 0 51.573334 40.213333A469.333333 469.333333 0 0 0 512 42.666667z m92.053333 853.333333a26.666667 26.666667 0 0 1-32-17.973333 234.666667 234.666667 0 0 0-83.52-119.786667c-53.333333-40.373333-117.866667-56.32-180.106666-71.786667-124.426667-30.826667-184.533333-51.253333-191.093334-178.346666-5.333333-97.12 30.4-191.04 100.16-264.533334A407.68 407.68 0 0 1 512 117.333333a394.666667 394.666667 0 0 1 92.053333 778.666667z" p-id="15017" fill="currentColor"></path>
    <path d="M669.44 737.173333m-72 0a72 72 0 1 0 144 0 72 72 0 1 0-144 0Z" p-id="15018" fill="currentColor"></path>
    <path d="M785.92 458.773333m-58.666667 0a58.666667 58.666667 0 1 0 117.333334 0 58.666667 58.666667 0 1 0-117.333334 0Z" p-id="15019" fill="currentColor"></path>
    <path d="M731.146667 347.466667a58.666667 58.666667 0 1 0-82.346667-10.08 58.666667 58.666667 0 0 0 82.346667 10.08z" p-id="15020" fill="currentColor"></path>
    <path d="M526.397092 233.08818m-50.287148 30.215567a58.666667 58.666667 0 1 0 100.574296-60.431134 58.666667 58.666667 0 1 0-100.574296 60.431134Z" p-id="15021" fill="currentColor"></path>
    <path d="M327.68 229.333333A58.666667 58.666667 0 1 0 405.333333 259.253333 58.666667 58.666667 0 0 0 327.68 229.333333z" p-id="15022" fill="currentColor"></path>
  </svg>
)

export const InfoIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path d="M248 64C146.39 64 64 146.39 64 248s82.39 184 184 184s184-82.39 184-184S349.61 64 248 64z" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32"></path>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32" d="M220 220h32v116"></path>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32" d="M208 340h88"></path>
    <path d="M248 130a26 26 0 1 0 26 26a26 26 0 0 0-26-26z" fill="currentColor"></path>
  </svg>
)

export const ReplayIcon: React.FC<IconProps> = ({ className }) => (
<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" strokeWidth={1.5} stroke="currentColor" className={className}>
  <path d="M658.18819 780.775619l213.333334-213.333333 27.599238-27.599238-27.599238-27.599238-213.333334-213.333334-55.198476 55.198476 146.773334 146.724572H346.160762a103.228952 103.228952 0 0 1-103.228952-103.228953V255.414857h-78.019048v142.189714A181.248 181.248 0 0 0 346.209524 578.852571h403.602286l-146.773334 146.773334 55.198476 55.100952z" fill="currentColor"></path>
</svg>
)

export const AlertInfoIcon: React.FC<IconProps> = ({ className }) => (
<svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5} 
    stroke="currentColor"
    className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
  </svg>
)
export const AlertWarningIcon: React.FC<IconProps> = ({ className }) => (
  <svg
  xmlns="http://www.w3.org/2000/svg"
  strokeWidth={1.5} 
  stroke="currentColor"
  className={className}
  fill="none"
  viewBox="0 0 24 24">
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
</svg>
)

export const AlertErrorIcon: React.FC<IconProps> = ({ className }) => (
  <svg
  xmlns="http://www.w3.org/2000/svg"
  strokeWidth={1.5} 
  stroke="currentColor"
  className={className}
  fill="none"
  viewBox="0 0 24 24">
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>
)

export const AlertSuccessIcon: React.FC<IconProps> = ({ className }) => (
  <svg
  xmlns="http://www.w3.org/2000/svg"
  strokeWidth={1.5} 
  stroke="currentColor"
  className={className}
  fill="none"
  viewBox="0 0 24 24">
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>
)

export const CodeIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path d="M31 16l-7 7l-1.41-1.41L28.17 16l-5.58-5.59L24 9l7 7z" fill="currentColor"></path>
    <path d="M1 16l7-7l1.41 1.41L3.83 16l5.58 5.59L8 23l-7-7z" fill="currentColor"></path>
    <path d="M12.419 25.484L17.639 6l1.932.518L14.35 26z" fill="currentColor"></path>
  </svg>
)


export const ComponentsIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path d="M3 12l3 3l3-3l-3-3z"></path><path d="M15 12l3 3l3-3l-3-3z"></path><path d="M9 6l3 3l3-3l-3-3z"></path>
      <path d="M9 18l3 3l3-3l-3-3z"></path>
  </svg>
)
