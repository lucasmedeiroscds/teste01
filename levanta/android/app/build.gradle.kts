plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    // AlarmeSalvo, no repositório, é @Serializable.
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "br.com.levanta"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.levanta"
        // 26 é onde java.time entra nativo e onde showWhenLocked/turnScreenOn
        // funcionam sem gambiarra — cobre praticamente todo aparelho em uso.
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        resourceConfigurations += listOf("pt-rBR", "pt", "en")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            applicationIdSuffix = ".debug"
        }

        // Build para diagnosticar problema em aparelho: sem R8, para descartar
        // a minificação como causa, e sem o `ui-tooling` do Compose, que só
        // entra na variante `debug` e sozinho responde por boa parte do dex.
        // Assinado com a chave de depuração, então instala direto.
        create("diagnostico") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".diagnostico"
            isMinifyEnabled = false
            isShrinkResources = false
            matchingFallbacks += "debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures { compose = true }

    // O modelo de pose do ML Kit vem embutido, com bibliotecas nativas para
    // quatro arquiteturas. Sem esta divisão o APK sai com as quatro (74 MB só
    // de `lib/`); com ela cada celular baixa a sua. O universal fica para quem
    // não sabe qual usar.
    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a", "armeabi-v7a")
            isUniversalApk = true
        }
    }

    sourceSets["main"].java.srcDirs("src/main/kotlin")

    packaging {
        resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}")
    }
}

/*
 * Só no `diagnostico`: comprime as bibliotecas nativas dentro do APK.
 *
 * Por padrão o AGP guarda os `.so` descomprimidos, para o sistema mapeá-los
 * direto do APK — melhor no dia a dia, mas a `libxeno_native.so` do ML Kit
 * sozinha ocupa 20,6 MB assim, contra 5,4 MB comprimida. Como este build existe
 * para ser transferido e instalado à mão, o arquivo menor vale mais que o ganho
 * de inicialização; em troca, o sistema extrai os `.so` na instalação e o app
 * ocupa mais espaço no aparelho.
 *
 * O release continua com o padrão, que é o certo para uso normal.
 */
androidComponents {
    onVariants(selector().withBuildType("diagnostico")) { variante ->
        variante.packaging.jniLibs.useLegacyPackaging.set(true)
    }
}

dependencies {
    implementation(project(":core"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.camera.core)
    implementation(libs.camera.camera2)
    implementation(libs.camera.lifecycle)
    implementation(libs.camera.view)
    implementation(libs.mlkit.pose.detection)

    implementation(libs.kotlinx.serialization.json)
}
