plugins {
    java
}

group = "com.hpfxd.pandaspigot"
version = "1.0.1"

repositories {
    mavenCentral()
    maven("https://repo.viaversion.com")
}

dependencies {
    compileOnly(project(":pandaspigot-api")) { isTransitive = false }
    compileOnly("net.kyori:adventure-api:4.24.0")
    compileOnly("com.viaversion:viaversion-common:5.12.1") { isTransitive = false }
    compileOnly("io.netty:netty-transport:4.1.132.Final")
    testImplementation("junit:junit:4.12")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.release = 17
}

tasks.processResources {
    inputs.property("version", project.version)
    filesMatching("plugin.yml") { expand("version" to project.version) }
}
