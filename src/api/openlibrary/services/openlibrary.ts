import { Root, processRoot } from "./json-import";

export default () => ({
  allFetchAndSave: async (root: Root) => {
    return processRoot(root);
}});
