use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub struct CustomError {
    code: u32,
    message: String,
}

impl CustomError {
    pub fn new(code: u32, message: String) -> Self {
        CustomError { code, message }
    }
}

impl fmt::Display for CustomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[Error Code: {}] {}", self.code, self.message)
    }
}

impl Error for CustomError {}
