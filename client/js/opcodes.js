// Draw by Numeral
// (c) Brendan Berg 2019-2024

// prettier-ignore
export const HALT = 0x00,
    CONSTANT = 0x01,
    GET_ARGUMENT = 0x02,
    SET_ARGUMENT = 0x03,
    GET_LOCAL = 0x04,
    SET_LOCAL = 0x05,

    ADD = 0x12,
    SUBTRACT = 0x13,
    MULTIPLY = 0x14,
    DIVIDE = 0x15,
    REMAINDER = 0x16,
    NEGATE = 0x17,

    DUPLICATE = 0x20,
    POP = 0x2F,

    SET_PEN_COLOR = 0x40,
    READ_PIXEL = 0x41,
    WRITE_PIXEL = 0x42,
    FILL_PIXEL = 0x43,
    FILL_CANVAS = 0x44,
    REDRAW = 0x45,
    REDRAW_OFF = 0x46,
    REDRAW_FORCE = 0x47,

    CLAMP = 0x49,
    PACK_GRAY = 0x4A,
    PACK_RGB = 0x4B,
    PACK_RGBA = 0x4C,
    UNPACK_GRAY = 0x4D,
    UNPACK_RGB = 0x4E,
    UNPACK_RGBA = 0x4F,

    JUMP = 0x50,
    JUMP_IF_NEGATIVE = 0x51,
    JUMP_IF_NONNEGATIVE = 0x52,
    JUMP_IF_ZERO = 0x53,
    JUMP_IF_NONZERO = 0x54,

    PAUSE = 0x60,

    STACK_ALLOC = 0x70,
    STACK_FREE = 0x71,

    CALL = 0x80,
    INVOKE = 0x81,
    RETURN = 0x8F,

    LOCATION_PUSH = 0xFB,
    LOCATION_POP = 0xFC,
    ARGUMENT = 0xFE,
    LABEL = 0xFF;
