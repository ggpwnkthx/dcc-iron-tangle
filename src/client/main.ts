import { createUI } from "./interface.ts";
import { createModel } from "./model.ts";
import { createNavigation } from "./navigation.ts";

const ui = createUI();
const model = createModel(ui);
createNavigation(model, ui);
