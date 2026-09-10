// O bundler resolve os imports de CSS em runtime; o TypeScript so precisa
// saber que eles existem.

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
