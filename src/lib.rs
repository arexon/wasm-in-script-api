mod js;

use oxc::{allocator::Allocator, parser::Parser, span::SourceType};
use serde::Deserialize;

use crate::js::JsString;

#[derive(Debug, Deserialize)]
struct ItemUseBeforeEvent {
    item_stack: ItemStack,
}

#[derive(Debug, Deserialize)]
struct ItemStack {
    type_id: String,
    amount: u32,
}

#[no_mangle]
pub fn item_use(event_ptr: *const u8, event_len: usize) {
    let event = JsString::from_raw(event_ptr, event_len);
    let event: ItemUseBeforeEvent = serde_json::from_str(&event).unwrap();

    let item_name = event.item_stack.type_id.split_once(":").unwrap().1;
    log(&format!(
        "Used item `{}` x {}",
        item_name, event.item_stack.amount
    ))
}

#[no_mangle]
pub fn send_message(msg_ptr: *const u8, msg_len: usize) -> (*const u8, usize) {
    let msg = JsString::from_raw(msg_ptr, msg_len);
    let res = format!("Message received: `{}`. This is from Rust", *msg);
    (res.as_ptr(), res.len())
}

#[no_mangle]
pub fn parse_js(code_ptr: *const u8, code_len: usize) -> (*const u8, usize) {
    let code = JsString::from_raw(code_ptr, code_len);

    let allocator = Allocator::default();
    let mut errors = Vec::new();
    let ret = Parser::new(&allocator, &code, SourceType::ts()).parse();
    errors.extend(ret.errors);
    if ret.panicked {
        for err in &errors {
            error(&format!("{err:?}"));
        }
    }
    let res = ret.program.to_json();
    (res.as_ptr(), res.len())
}

#[no_mangle]
pub fn alloc(size: usize) -> *mut u8 {
    let layout = std::alloc::Layout::from_size_align(size, 1).unwrap();
    let ptr = unsafe { std::alloc::alloc(layout) };
    ptr
}

#[inline]
fn log(msg: &str) {
    unsafe { console_log(msg.as_ptr(), msg.len()) }
}

#[inline]
fn error(msg: &str) {
    unsafe { console_error(msg.as_ptr(), msg.len()) }
}

pub fn dealloc(ptr: *mut u8, size: usize) {
    let layout = std::alloc::Layout::from_size_align(size, 1).unwrap();
    unsafe { std::alloc::dealloc(ptr, layout) };
}

extern "C" {
    pub fn console_log(msg_ptr: *const u8, msg_len: usize);
    pub fn console_error(msg_ptr: *const u8, msg_len: usize);
}
