export default {
    ignore: {
        src: ["#api", "#shared", "#testing", "#ui", "#cli", "~"],
        dependencies: [
            "@types/react",
            "@types/react-dom",
            "react-dom",
            "@mantine/hooks",
            "concurrently",
            "typescript",
            "dotenv",
        ],
        devDependencies: true,
        peerDependencies: true
    },
    ignoreDirs: ["node_modules/", "dist/", ".webiny/", "code/"],
    packages: ["./"]
};
