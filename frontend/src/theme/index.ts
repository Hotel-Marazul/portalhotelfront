import { createTheme } from "@mui/material/styles";

// Mesmos valores de styles/globals.css, até a última tela sair do MUI.
const FONT_FAMILY = "var(--font-hanken), system-ui, sans-serif";

const theme = createTheme({
  palette: {
    primary: {
      main: "#2F6B70",
      light: "#8DB3B5",
      dark: "#1F4F53",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#1C1D1F",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F7F7F5",
      paper: "#ffffff",
    },
    text: {
      primary: "#1C1D1F",
      secondary: "#50555A",
    },
    divider: "#E2E2DE",
    error: { main: "#dc2626" },
    warning: { main: "#925b13" },
    success: { main: "#247458" },
    info: { main: "#28648c" },
  },
  typography: {
    fontFamily: FONT_FAMILY,
    h1: { fontWeight: 600, fontFamily: FONT_FAMILY },
    h2: { fontFamily: FONT_FAMILY },
    h3: { fontFamily: FONT_FAMILY },
    h4: { fontFamily: FONT_FAMILY },
    h5: { fontFamily: FONT_FAMILY },
    h6: { fontFamily: FONT_FAMILY },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButtonBase: { styleOverrides: { root: { "&.Mui-focusVisible": { outline: "3px solid #2F6B70", outlineOffset: 3 } } } },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          minHeight: 40,
          fontFamily: FONT_FAMILY,
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #E2E2DE",
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
          backgroundColor: "#F7F7F5",
          fontWeight: 600,
          fontSize: "0.8125rem",
          letterSpacing: "0",
          textTransform: "none",
          color: "#50555A",
          borderBottom: "2px solid #E2E2DE",
          fontFamily: FONT_FAMILY,
          padding: "10px 16px",
        },
        root: {
          borderColor: "#E2E2DE",
          fontFamily: FONT_FAMILY,
          fontSize: "0.875rem",
          padding: "12px 16px",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&.MuiTableRow-hover:hover": {
            backgroundColor: "#F7F7F5",
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          border: "1px solid #E2E2DE",
          boxShadow: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: "6px",
          fontFamily: FONT_FAMILY,
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
          border: "1px solid #E2E2DE",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: FONT_FAMILY,
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
          fontFamily: FONT_FAMILY,
          fontSize: "0.875rem",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: "#81929d",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: FONT_FAMILY,
          fontSize: "0.875rem",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: "10px",
          fontFamily: FONT_FAMILY,
          fontSize: "0.875rem",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: "3px",
          height: "6px",
          backgroundColor: "#E2E2DE",
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          fontFamily: FONT_FAMILY,
          fontSize: "0.875rem",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: FONT_FAMILY,
          fontSize: "0.875rem",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontFamily: FONT_FAMILY,
          fontWeight: 500,
          fontSize: "0.875rem",
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: "#2F6B70",
          height: "2px",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 40, minHeight: 40,
          borderRadius: "8px",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderLeft: "1px solid #E2E2DE",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontFamily: FONT_FAMILY,
          fontSize: "0.75rem",
          borderRadius: "6px",
          backgroundColor: "#1C1D1F",
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: {
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: "8px",
          paddingBlock: "8px",
        },
        spacer: { flex: "1 1 0%" },
        selectLabel: {
          fontFamily: FONT_FAMILY,
          fontSize: "0.875rem",
          margin: 0,
        },
        displayedRows: {
          fontFamily: FONT_FAMILY,
          fontSize: "0.875rem",
          margin: 0,
        },
        actions: { marginLeft: 0 },
        root: {
          fontFamily: FONT_FAMILY,
          fontSize: "0.8rem",
          borderTop: "1px solid #E2E2DE",
        },
      },
    },
  },
});

export default theme;
