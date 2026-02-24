declare module 'js-yaml' {
  interface YamlModule {
    load: (yaml: string) => unknown
    dump: (value: unknown) => string
  }

  const YamlParser: YamlModule

  export default YamlParser
}
