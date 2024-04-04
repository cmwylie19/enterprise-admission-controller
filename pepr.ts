import { PeprModule } from "pepr";
// cfg loads your pepr configuration from package.json
import cfg from "./package.json";

import { Admission } from "./capabilities/admission";

new PeprModule(cfg, [Admission]);
