const test = "ahoj jak se máš";
const t = test.split("").map((d) => d.charCodeAt(0) << 1);
console.log(t.join(", "));
