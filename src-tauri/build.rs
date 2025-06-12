fn main() {
    #[cfg(feature = "desktop")]
    {
        println!("cargo:rustc-cfg=desktop");
        tauri_build::build()
    }

    #[cfg(feature = "web")]
    {
        println!("cargo:rustc-cfg=web");
    }
}
