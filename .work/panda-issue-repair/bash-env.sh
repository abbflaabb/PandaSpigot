# Git Bash on this device rejects writes addressed through an absolute /c/Users/Admin path.
# Convert only absolute paths inside this checked-out workspace to relative paths.
mkdir() {
    local -a args=()
    local arg
    for arg in "$@"; do
        case "$arg" in
            /c/Users/Admin/Desktop/Intellija/PandaSpigot/*)
                arg="${arg#/c/Users/Admin/Desktop/Intellija/PandaSpigot/}"
                ;;
        esac
        args+=("$arg")
    done
    command mkdir "${args[@]}"
}
