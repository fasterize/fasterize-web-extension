console.log('------ Fasterize logs ------');
if (fasterizeNs) {
  if (fasterizeNs.deferJs) {
    console.log('------ Fasterize SmartJS logs ------');
    console.dir(fasterizeNs.deferJs.logs);
    console.log('------ Fasterize SmartJS logs ------');
  }

  if (fasterizeNs.seoCsrNs) {
    console.log('------ Fasterize Seo logs ------');
    console.dir(fasterizeNs.seoCsrNs.logs);
    console.log('------ Fasterize Seo logs ------');
  }

  if (fasterizeNs.lazyloadJsNs) {
    console.log('------ Fasterize LazyloadJS logs ------');
    console.dir(fasterizeNs.lazyloadJsNs.logs);
    console.log('------ Fasterize LazyloadJS logs ------');
  }

  if (fasterizeNs.smartInpNs) {
    console.log('------ Fasterize SmartInp logs ------');
    console.dir(fasterizeNs.smartInpNs.logs);
    console.log('------ Fasterize SmartInp logs ------');
  }
}
console.log('------ Fasterize logs ------');
