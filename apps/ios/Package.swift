// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "PersonalAIWorkspace",
    platforms: [
        .iOS(.v18)
    ],
    products: [
        .library(
            name: "PersonalAIWorkspace",
            targets: ["PersonalAIWorkspace"]
        ),
    ],
    targets: [
        .target(
            name: "PersonalAIWorkspace",
            path: "PersonalAIWorkspace"
        ),
    ]
)
