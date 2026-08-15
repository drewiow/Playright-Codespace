export function createTestLogger(logger) {

    return {

        step(name) {
            logger(`🧪 ${name}`);
        },

        pass(name) {
            logger(`✅ ${name}`);
        },

        fail(name, err) {
            logger(`❌ ${name}: ${err}`);
        },

        info(msg) {
            logger(`ℹ️ ${msg}`);
        },

        artifact(name) {
            logger(`📸 Artifact: ${name}`);
        }
    };
}