#[link(name = "objc")]
extern "C" {
    fn objc_getClass(name: *const std::ffi::c_char) -> cocoa::base::id;
    fn object_setClass(obj: cocoa::base::id, cls: cocoa::base::id) -> cocoa::base::id;
}
fn main() {}
