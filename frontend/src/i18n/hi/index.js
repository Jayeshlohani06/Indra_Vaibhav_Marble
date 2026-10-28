// Hindi text, keyed by the English text used in the code. One file per area
// so each page's words stay together.
import common from "./common";
import cash from "./cash";
import sales from "./sales";
import inventory from "./inventory";
import purchases from "./purchases";
import other from "./other";

const hi = { ...common, ...cash, ...sales, ...inventory, ...purchases, ...other };

export default hi;
