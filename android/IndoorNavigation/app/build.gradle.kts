plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.example.wififingerprintcollector"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.example.wififingerprintcollector"
        minSdk = 26
        targetSdk = 36
        versionCode = 5
        versionName = "1.0.5"
        manifestPlaceholders["appLabel"] = "Wi-Fi 指紋採樣工具"
    }

    flavorDimensions += "mode"
    productFlavors {
        create("collector") {
            dimension = "mode"
            applicationId = "com.example.wififingerprintcollector"
            versionCode = 8
            versionName = "1.0.8"
            manifestPlaceholders["appLabel"] = "Wi-Fi 指紋採樣工具"
        }
        create("navigator") {
            dimension = "mode"
            applicationId = "com.example.indoor.navigator"
            versionCode = 53
            versionName = "1.0.53"
            manifestPlaceholders["appLabel"] = "智慧地下街Wi-Fi室內定位導航系統"
        }
    }

    buildFeatures {
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.recyclerview:recyclerview:1.3.2")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
}
