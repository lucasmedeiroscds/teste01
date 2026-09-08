# O ML Kit carrega modelos por reflexão; sem isto o release perde o detector.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }

# As classes @Serializable do repositório de alarmes.
-keepclassmembers class br.com.levanta.dados.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keepattributes *Annotation*, InnerClasses
