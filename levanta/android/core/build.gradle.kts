import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

// Kotlin puro, sem uma linha de Android: é o que permite rodar o motor de
// contagem e o agendamento na JVM, em `./gradlew :core:test`, sem emulador.
// O bytecode sai em 17 para o módulo `:app` do Android poder consumi-lo.
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.kotlinx.serialization.json)
    testImplementation(libs.junit)
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnit()
    testLogging { events("passed", "failed", "skipped") }
}
