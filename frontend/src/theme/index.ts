import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#f59e0b",
      light: "#fbbf24",
      dark: "#d97706",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#0f172a",
      contrastText: "#f1f5f9",
    },
    background: {
      default: "#f7f5f1",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#78716c",
    },
    divider: "#ede9e3",
    error: { main: "#dc2626" },
    warning: { main: "#d97706" },
    success: { main: "#16a34a" },
    info: { main: "#0ea5e9" },
  },
  typography: {
    fontFamily: "'DM Sans', sans-serif",
    h1: { fontFamily: "'Cormorant Garamond', Georgia, serif" },
    h2: { fontFamily: "'Cormorant Garamond', Georgia, serif" },
    h3: { fontFamily: "'Cormorant Garamond', Georgia, serif" },
    h4: { fontFamily: "'Cormorant Garamond', Georgia, serif" },
    h5: { fontFamily: "'Cormorant Garamond', Georgia, serif" },
    h6: { fontFamily: "'Cormorant Garamond', Georgia, serif" },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          fontFamily: "'DM Sans', sans-serif",
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #ede9e3",
          borderRadius: "12px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: "#f7f5f1",
          fontWeight: 600,
          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#78716c",
          borderBottom: "2px solid #ede9e3",
          fontFamily: "'DM Sans', sans-serif",
          padding: "10px 16px",
        },
        root: {
          borderColor: "#ede9e3",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.875rem",
          padding: "12px 16px",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&.MuiTableRow-hover:hover": {
            backgroundColor: "#faf8f4",
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          border: "1px solid #ede9e3",
          boxShadow: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: "6px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.72rem",
          fontWeight: 500,
          height: "24px",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: "14px",
          border: "1px solid #ede9e3",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          fontSize: "1rem",
          padding: "20px 24px 12px",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "12px 24px",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "12px 24px 20px",
          gap: "8px",
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: "#ede9e3",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: "10px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: "3px",
          height: "6px",
          backgroundColor: "#ede9e3",
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          fontSize: "0.875rem",
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: "#f59e0b",
          height: "2px",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderLeft: "1px solid #ede9e3",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.75rem",
          borderRadius: "6px",
          backgroundColor: "#0f172a",
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.8rem",
          borderTop: "1px solid #ede9e3",
        },
        selectLabel: {
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.8rem",
        },
        displayedRows: {
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.8rem",
        },
      },
    },
  },
});

export default theme;
