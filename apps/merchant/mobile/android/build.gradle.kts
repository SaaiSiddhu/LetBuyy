allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Flutter's integration_test plugin declares dynamic Maven versions. Keep its
// existing resolved test toolchain reproducible instead of refreshing metadata
// during an otherwise unchanged APK build. No SDK or shared cache is patched.
subprojects {
    if (name == "integration_test") {
        configurations.configureEach {
            resolutionStrategy.force(
                "androidx.test:runner:1.3.0",
                "androidx.test:rules:1.2.0",
                "androidx.test.espresso:espresso-core:3.3.0",
            )
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
