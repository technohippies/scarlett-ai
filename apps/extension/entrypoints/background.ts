export default defineBackground(() => {
  console.log('Background script started');
});

function defineBackground(fn: () => void) {
  return fn;
}