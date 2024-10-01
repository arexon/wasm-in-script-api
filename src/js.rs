use std::{ops, slice, str};

use super::dealloc;

pub struct JsString<'a> {
    ptr: *const u8,
    len: usize,
    str: &'a str,
}

impl<'a> JsString<'a> {
    pub fn from_raw(ptr: *const u8, len: usize) -> Self {
        let str = unsafe { str::from_utf8_unchecked(slice::from_raw_parts(ptr, len)) };
        Self { ptr, len, str }
    }
}

impl<'a> ops::Deref for JsString<'a> {
    type Target = &'a str;

    fn deref(&self) -> &Self::Target {
        &self.str
    }
}

impl Drop for JsString<'_> {
    fn drop(&mut self) {
        dealloc(self.ptr as *mut u8, self.len);
    }
}
